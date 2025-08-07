const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files from 'public' directory

// Database connection
const pool = mysql.createPool({
    host: 'localhost',
    user: 'captainswaqq', // Replace with your MySQL username
    password: 'anonymous', // Replace with your MySQL password
    database: 'swaqq_db'
});

// Test database connection
async function testDatabaseConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('Successfully connected to MySQL database');
        connection.release();
    } catch (error) {
        console.error('Database connection failed:', error.message);
        process.exit(1); // Exit process if database connection fails
    }
}

// Create tables if they don't exist
async function initializeDatabase() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS page_stats (
                id INT AUTO_INCREMENT PRIMARY KEY,
                views INT DEFAULT 0,
                likes INT DEFAULT 0,
                dislikes INT DEFAULT 0
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_interactions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_ip VARCHAR(45) NOT NULL,
                action ENUM('like', 'dislike') DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_user_action (user_ip, action)
            )
        `);

        // Initialize page_stats with one row if it doesn't exist
        const [rows] = await pool.query('SELECT COUNT(*) as count FROM page_stats');
        if (rows[0].count === 0) {
            await pool.query('INSERT INTO page_stats (views, likes, dislikes) VALUES (0, 0, 0)');
        }
        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Error initializing database:', error.message);
        throw error;
    }
}

// Middleware to get client IP
function getClientIp(req) {
    return req.headers['x-forwarded-for'] || req.connection.remoteAddress;
}

// Increment view count
app.post('/api/views', async (req, res) => {
    try {
        await pool.query('UPDATE page_stats SET views = views + 1 WHERE id = 1');
        const [rows] = await pool.query('SELECT views FROM page_stats WHERE id = 1');
        res.json({ views: rows[0].views });
    } catch (error) {
        console.error('Error updating views:', error.message);
        res.status(500).json({ error: 'Failed to update view count' });
    }
});

// Get ratings
app.get('/api/ratings', async (req, res) => {
    try {
        const ip = getClientIp(req);
        const [stats] = await pool.query('SELECT likes, dislikes FROM page_stats WHERE id = 1');
        const [userAction] = await pool.query(
            'SELECT action FROM user_interactions WHERE user_ip = ?',
            [ip]
        );

        res.json({
            likes: stats[0].likes,
            dislikes: stats[0].dislikes,
            userLiked: userAction.some(row => row.action === 'like'),
            userDisliked: userAction.some(row => row.action === 'dislike')
        });
    } catch (error) {
        console.error('Error fetching ratings:', error.message);
        res.status(500).json({ error: 'Failed to fetch ratings' });
    }
});

// Handle like
app.post('/api/like', async (req, res) => {
    const ip = getClientIp(req);
    try {
        const [userAction] = await pool.query(
            'SELECT action FROM user_interactions WHERE user_ip = ?',
            [ip]
        );

        if (userAction.some(row => row.action === 'like')) {
            return res.json({ success: false, message: 'Already liked' });
        }

        if (userAction.some(row => row.action === 'dislike')) {
            await pool.query(
                'DELETE FROM user_interactions WHERE user_ip = ? AND action = "dislike"',
                [ip]
            );
            await pool.query('UPDATE page_stats SET dislikes = dislikes - 1 WHERE id = 1');
        }

        await pool.query(
            'INSERT INTO user_interactions (user_ip, action) VALUES (?, "like")',
            [ip]
        );
        await pool.query('UPDATE page_stats SET likes = likes + 1 WHERE id = 1');

        res.json({ success: true });
    } catch (error) {
        console.error('Error processing like:', error.message);
        res.status(500).json({ error: 'Failed to process like' });
    }
});

// Handle dislike
app.post('/api/dislike', async (req, res) => {
    const ip = getClientIp(req);
    try {
        const [userAction] = await pool.query(
            'SELECT action FROM user_interactions WHERE user_ip = ?',
            [ip]
        );

        if (userAction.some(row => row.action === 'dislike')) {
            return res.json({ success: false, message: 'Already disliked' });
        }

        if (userAction.some(row => row.action === 'like')) {
            await pool.query(
                'DELETE FROM user_interactions WHERE user_ip = ? AND action = "like"',
                [ip]
            );
            await pool.query('UPDATE page_stats SET likes = likes - 1 WHERE id = 1');
        }

        await pool.query(
            'INSERT INTO user_interactions (user_ip, action) VALUES (?, "dislike")',
            [ip]
        );
        await pool.query('UPDATE page_stats SET dislikes = dislikes + 1 WHERE id = 1');

        res.json({ success: true });
    } catch (error) {
        console.error('Error processing dislike:', error.message);
        res.status(500).json({ error: 'Failed to process dislike' });
    }
});

// Serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
const PORT = 3000;
app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await testDatabaseConnection();
    await initializeDatabase();
});
