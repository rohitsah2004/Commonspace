import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const posts = sqliteTable('posts', {
 id:text('id').primaryKey(), slug:text('slug').notNull().unique(), draft:text('draft').notNull(), published:text('published'),
 version:integer('version').notNull().default(1), createdAt:integer('created_at').notNull(), updatedAt:integer('updated_at').notNull(), publishedAt:integer('published_at'), deletedAt:integer('deleted_at'),scheduled:text('scheduled'),scheduledAt:integer('scheduled_at')
});
export const owners=sqliteTable('owners',{key:text('key').primaryKey(),userId:text('user_id').notNull()});
export const revisions=sqliteTable('revisions',{id:text('id').primaryKey(),postId:text('post_id').notNull(),content:text('content').notNull(),version:integer('version').notNull(),createdAt:integer('created_at').notNull()});
export const settings=sqliteTable('settings',{key:text('key').primaryKey(),value:text('value').notNull()});
export const collections=sqliteTable('collections',{id:text('id').primaryKey(),slug:text('slug').notNull().unique(),name:text('name').notNull(),description:text('description').notNull().default('')});
export const views=sqliteTable('views',{id:text('id').primaryKey(),postId:text('post_id').notNull(),day:text('day').notNull(),source:text('source').notNull()});
export const files=sqliteTable('files',{id:text('id').primaryKey(),key:text('key').notNull(),name:text('name').notNull(),type:text('type').notNull(),size:integer('size').notNull(),createdAt:integer('created_at').notNull()});
export const subscribers=sqliteTable('subscribers',{id:text('id').primaryKey(),email:text('email').notNull().unique(),status:text('status').notNull(),token:text('token').notNull().unique(),expiresAt:integer('expires_at').notNull(),createdAt:integer('created_at').notNull(),confirmedAt:integer('confirmed_at')});
export const deliveries=sqliteTable('deliveries',{id:text('id').primaryKey(),postId:text('post_id').notNull(),subscriberId:text('subscriber_id').notNull(),sentAt:integer('sent_at').notNull()});
