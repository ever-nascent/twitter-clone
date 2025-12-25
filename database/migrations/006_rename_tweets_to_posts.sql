-- Migration: Rename tweets to posts
-- Date: 2024
--
-- REBRAND: Change "tweets" to generic "posts" for flexibility
--
-- This migration renames the tweets table and all related references
-- to use the more generic term "posts"

-- Rename the table
ALTER TABLE IF EXISTS tweets RENAME TO posts;

-- Rename indexes
ALTER INDEX IF EXISTS idx_tweets_user_id RENAME TO idx_posts_user_id;
ALTER INDEX IF EXISTS idx_tweets_created_at RENAME TO idx_posts_created_at;

-- Rename the ID sequence
ALTER SEQUENCE IF EXISTS tweets_id_seq RENAME TO posts_id_seq;

-- Update comments
COMMENT ON TABLE posts IS 'User posts (previously tweets)';
