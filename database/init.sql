-- Twitter Clone Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    bio VARCHAR(280),
    location VARCHAR(100),
    website VARCHAR(255),
    profile_image_url VARCHAR(500),
    banner_image_url VARCHAR(500),
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT username_length CHECK (char_length(username) >= 3),
    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Tweets table
CREATE TABLE tweets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content VARCHAR(280) NOT NULL,
    reply_to_tweet_id INTEGER REFERENCES tweets(id) ON DELETE SET NULL,
    retweet_of_tweet_id INTEGER REFERENCES tweets(id) ON DELETE CASCADE,
    likes_count INTEGER DEFAULT 0,
    retweets_count INTEGER DEFAULT 0,
    replies_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT content_not_empty CHECK (char_length(content) > 0)
);

-- Follows table (many-to-many relationship)
CREATE TABLE follows (
    follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (follower_id, following_id),
    CONSTRAINT no_self_follow CHECK (follower_id != following_id)
);

-- Likes table
CREATE TABLE likes (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tweet_id INTEGER NOT NULL REFERENCES tweets(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, tweet_id)
);

-- Media table
CREATE TABLE media (
    id SERIAL PRIMARY KEY,
    tweet_id INTEGER NOT NULL REFERENCES tweets(id) ON DELETE CASCADE,
    media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('image', 'video', 'gif')),
    url VARCHAR(500) NOT NULL,
    width INTEGER,
    height INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications table
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('like', 'retweet', 'reply', 'follow', 'mention')),
    content JSONB NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Refresh tokens table (for secure authentication)
CREATE TABLE refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_tweets_user_id ON tweets(user_id);
CREATE INDEX idx_tweets_created_at ON tweets(created_at DESC);
CREATE INDEX idx_tweets_reply_to ON tweets(reply_to_tweet_id);
CREATE INDEX idx_follows_follower ON follows(follower_id);
CREATE INDEX idx_follows_following ON follows(following_id);
CREATE INDEX idx_likes_tweet ON likes(tweet_id);
CREATE INDEX idx_likes_user ON likes(user_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, read);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updating updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tweets_updated_at BEFORE UPDATE ON tweets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to increment/decrement counts
CREATE OR REPLACE FUNCTION update_tweet_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF TG_TABLE_NAME = 'likes' THEN
            UPDATE tweets SET likes_count = likes_count + 1 WHERE id = NEW.tweet_id;
        ELSIF TG_TABLE_NAME = 'tweets' AND NEW.reply_to_tweet_id IS NOT NULL THEN
            UPDATE tweets SET replies_count = replies_count + 1 WHERE id = NEW.reply_to_tweet_id;
        ELSIF TG_TABLE_NAME = 'tweets' AND NEW.retweet_of_tweet_id IS NOT NULL THEN
            UPDATE tweets SET retweets_count = retweets_count + 1 WHERE id = NEW.retweet_of_tweet_id;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        IF TG_TABLE_NAME = 'likes' THEN
            UPDATE tweets SET likes_count = likes_count - 1 WHERE id = OLD.tweet_id;
        ELSIF TG_TABLE_NAME = 'tweets' AND OLD.reply_to_tweet_id IS NOT NULL THEN
            UPDATE tweets SET replies_count = replies_count - 1 WHERE id = OLD.reply_to_tweet_id;
        ELSIF TG_TABLE_NAME = 'tweets' AND OLD.retweet_of_tweet_id IS NOT NULL THEN
            UPDATE tweets SET retweets_count = retweets_count - 1 WHERE id = OLD.retweet_of_tweet_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Triggers for automatic count updates
CREATE TRIGGER update_likes_count AFTER INSERT OR DELETE ON likes
    FOR EACH ROW EXECUTE FUNCTION update_tweet_counts();

CREATE TRIGGER update_replies_count AFTER INSERT OR DELETE ON tweets
    FOR EACH ROW EXECUTE FUNCTION update_tweet_counts();

-- Sample data for development
INSERT INTO users (username, email, password_hash, display_name, bio) VALUES
('john_doe', 'john@example.com', '$2b$10$YourHashedPasswordHere', 'John Doe', 'Software developer and coffee enthusiast'),
('jane_smith', 'jane@example.com', '$2b$10$YourHashedPasswordHere', 'Jane Smith', 'Designer | Creator | Dreamer');

-- John follows Jane
INSERT INTO follows (follower_id, following_id) VALUES (1, 2);

-- Sample tweets
INSERT INTO tweets (user_id, content) VALUES
(1, 'Just set up my Twitter clone! This is exciting!'),
(2, 'Hello world! First tweet on this new platform.'),
(1, 'Learning about authentication and it''s fascinating how secure modern systems are.');

-- Sample like
INSERT INTO likes (user_id, tweet_id) VALUES (2, 1);

-- Sample notification
INSERT INTO notifications (user_id, type, content) VALUES
(1, 'like', '{"userId": 2, "username": "jane_smith", "tweetId": 1}');
