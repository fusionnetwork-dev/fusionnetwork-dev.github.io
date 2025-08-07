CREATE DATABASE IF NOT EXISTS swaqq_db;

USE swaqq_db;

CREATE TABLE IF NOT EXISTS page_stats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    views INT DEFAULT 0,
    likes INT DEFAULT 0,
    dislikes INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_interactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_ip VARCHAR(45) NOT NULL,
    action ENUM('like', 'dislike') DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_action (user_ip, action)
);

INSERT INTO page_stats (views, likes, dislikes) 
SELECT 0, 0, 0 
WHERE NOT EXISTS (SELECT 1 FROM page_stats WHERE id = 1);
