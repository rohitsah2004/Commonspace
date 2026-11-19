import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const posts = sqliteTable('posts', {
 id:text('id').primaryKey(), slug:text('slug').notNull().unique(), draft:text('draft').notNull(), published:text('published'),
 version:integer('version').notNull().default(1), createdAt:integer('created_at').notNull(), updatedAt:integer('updated_at').notNull(), publishedAt:integer('published_at'), deletedAt:integer('deleted_at'),scheduled:text('scheduled'),scheduledAt:integer('scheduled_at')
}, table => [index('posts_public_idx').on(table.deletedAt,table.publishedAt)]);
export const owners=sqliteTable('owners',{key:text('key').primaryKey(),userId:text('user_id').notNull()});
export const revisions=sqliteTable('revisions',{id:text('id').primaryKey(),postId:text('post_id').notNull(),content:text('content').notNull(),version:integer('version').notNull(),createdAt:integer('created_at').notNull()});
export const settings=sqliteTable('settings',{key:text('key').primaryKey(),value:text('value').notNull()});
export const collections=sqliteTable('collections',{id:text('id').primaryKey(),slug:text('slug').notNull().unique(),name:text('name').notNull(),description:text('description').notNull().default('')});
export const views=sqliteTable('views',{id:text('id').primaryKey(),postId:text('post_id').notNull(),day:text('day').notNull(),source:text('source').notNull()});
export const files=sqliteTable('files',{id:text('id').primaryKey(),key:text('key').notNull(),name:text('name').notNull(),type:text('type').notNull(),size:integer('size').notNull(),createdAt:integer('created_at').notNull()});
export const subscribers=sqliteTable('subscribers',{id:text('id').primaryKey(),email:text('email').notNull().unique(),status:text('status').notNull(),token:text('token').notNull().unique(),expiresAt:integer('expires_at').notNull(),createdAt:integer('created_at').notNull(),confirmedAt:integer('confirmed_at')});
export const deliveries=sqliteTable('deliveries',{id:text('id').primaryKey(),postId:text('post_id').notNull(),subscriberId:text('subscriber_id').notNull(),sentAt:integer('sent_at').notNull()});

export const rateLimits = sqliteTable('rate_limits', {
  key: text('key').primaryKey(),
  windowStart: integer('window_start').notNull(),
  count: integer('count').notNull(),
}, table => [index('rate_limits_cleanup_idx').on(table.windowStart)]);

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(), ownerId: text('owner_id').notNull(),
  name: text('name').notNull(), platform: text('platform').notNull(),
  difficulty: text('difficulty').notNull(), status: text('status').notNull(),
  createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull(),
}, table => [index('sessions_owner_idx').on(table.ownerId, table.updatedAt)]);
export const sessionEntries = sqliteTable('session_entries', {
  id: text('id').primaryKey(), sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  ownerId: text('owner_id').notNull(), type: text('type').notNull(), phase: text('phase').notNull(),
  content: text('content').notNull(), createdAt: integer('created_at').notNull(),
}, table => [index('session_entries_session_created_idx').on(table.sessionId, table.createdAt)]);
