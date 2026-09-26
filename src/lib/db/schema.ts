import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  pgEnum,
  serial,
  index,
  uniqueIndex,
  jsonb,
  bigint,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

function generateUuid(): string {
  if (typeof globalThis !== "undefined" && globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── Enums ────────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum("user_role", ["admin", "agent", "user"]);

export const ticketStatusEnum = pgEnum("ticket_status", [
  "open",
  "assigned",
  "in_progress",
  "pending",
  "waiting_for_user",
  "waiting_for_third_party",
  "resolved",
  "closed",
  "reopened",
  "cancelled",
]);

export const ticketPriorityEnum = pgEnum("ticket_priority", [
  "critical",
  "high",
  "medium",
  "low",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "ticket_created",
  "ticket_assigned",
  "ticket_updated",
  "ticket_resolved",
  "ticket_closed",
  "ticket_reopened",
  "new_message",
  "new_internal_note",
  "sla_warning",
  "sla_breach",
  "mention",
]);

export const auditActionEnum = pgEnum("audit_action", [
  "login",
  "logout",
  "ticket_created",
  "ticket_updated",
  "ticket_assigned",
  "ticket_reassigned",
  "ticket_status_changed",
  "ticket_priority_changed",
  "ticket_resolved",
  "ticket_closed",
  "ticket_reopened",
  "message_created",
  "internal_note_created",
  "attachment_uploaded",
  "attachment_deleted",
  "user_created",
  "user_updated",
  "user_deactivated",
  "user_activated",
  "department_created",
  "department_updated",
  "category_created",
  "category_updated",
  "sla_policy_created",
  "sla_policy_updated",
  "settings_updated",
  "password_changed",
  "password_reset",
]);

export const messageTypeEnum = pgEnum("message_type", [
  "public",
  "internal_note",
]);

export const slaStatusEnum = pgEnum("sla_status", [
  "active",
  "paused",
  "completed",
  "breached",
  "warning",
]);

export const articleStatusEnum = pgEnum("article_status", [
  "draft",
  "published",
  "archived",
]);

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey().$defaultFn(() => generateUuid()),
    email: varchar("email", { length: 255 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    passwordHash: text("password_hash"),
    role: userRoleEnum("role").notNull().default("user"),
    avatarUrl: text("avatar_url"),
    phone: varchar("phone", { length: 50 }),
    departmentId: text("department_id"),
    isActive: boolean("is_active").notNull().default(true),
    emailVerified: timestamp("email_verified"),
    lastLoginAt: timestamp("last_login_at"),
    loginAttempts: integer("login_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_idx").on(table.email),
    roleIdx: index("users_role_idx").on(table.role),
    departmentIdx: index("users_department_idx").on(table.departmentId),
    activeIdx: index("users_active_idx").on(table.isActive),
  })
);

// ─── Sessions (NextAuth) ──────────────────────────────────────────────────────

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const accounts = pgTable("accounts", {
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

// ─── Password Reset Tokens ────────────────────────────────────────────────────

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: text("id").primaryKey().$defaultFn(() => generateUuid()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Departments ──────────────────────────────────────────────────────────────

export const departments = pgTable(
  "departments",
  {
    id: text("id").primaryKey().$defaultFn(() => generateUuid()),
    name: varchar("name", { length: 255 }).notNull().unique(),
    description: text("description"),
    color: varchar("color", { length: 7 }).default("#6366f1"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    nameIdx: uniqueIndex("departments_name_idx").on(table.name),
  })
);

// ─── Categories ───────────────────────────────────────────────────────────────

export const categories = pgTable(
  "categories",
  {
    id: text("id").primaryKey().$defaultFn(() => generateUuid()),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    departmentId: text("department_id").references(() => departments.id, {
      onDelete: "set null",
    }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    deptIdx: index("categories_dept_idx").on(table.departmentId),
  })
);

export const subcategories = pgTable(
  "subcategories",
  {
    id: text("id").primaryKey().$defaultFn(() => generateUuid()),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    categoryIdx: index("subcategories_category_idx").on(table.categoryId),
  })
);

// ─── Tags ─────────────────────────────────────────────────────────────────────

export const tags = pgTable(
  "tags",
  {
    id: text("id").primaryKey().$defaultFn(() => generateUuid()),
    name: varchar("name", { length: 100 }).notNull().unique(),
    color: varchar("color", { length: 7 }).default("#6366f1"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    nameIdx: uniqueIndex("tags_name_idx").on(table.name),
  })
);

// ─── SLA Policies ─────────────────────────────────────────────────────────────

export const slaPolicies = pgTable(
  "sla_policies",
  {
    id: text("id").primaryKey().$defaultFn(() => generateUuid()),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    priority: ticketPriorityEnum("priority").notNull(),
    departmentId: text("department_id").references(() => departments.id, {
      onDelete: "set null",
    }),
    // Response time in minutes
    firstResponseMinutes: integer("first_response_minutes").notNull(),
    // Resolution time in minutes
    resolutionMinutes: integer("resolution_minutes").notNull(),
    // Warning threshold percentage (e.g., 80 means warn at 80% of SLA time)
    warningThresholdPercent: integer("warning_threshold_percent")
      .notNull()
      .default(80),
    // Business hours: use business hours for SLA calculation
    useBusinessHours: boolean("use_business_hours").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    priorityIdx: index("sla_policies_priority_idx").on(table.priority),
  })
);

export const businessHours = pgTable("business_hours", {
  id: text("id").primaryKey().$defaultFn(() => generateUuid()),
  // 0=Sunday, 1=Monday ... 6=Saturday
  dayOfWeek: integer("day_of_week").notNull(),
  isOpen: boolean("is_open").notNull().default(true),
  openTime: varchar("open_time", { length: 5 }).notNull().default("09:00"),
  closeTime: varchar("close_time", { length: 5 }).notNull().default("17:00"),
  timezone: varchar("timezone", { length: 100 })
    .notNull()
    .default("Asia/Jakarta"),
});

// ─── Tickets ──────────────────────────────────────────────────────────────────

export const tickets = pgTable(
  "tickets",
  {
    id: text("id").primaryKey().$defaultFn(() => generateUuid()),
    ticketNumber: serial("ticket_number").notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description").notNull(),
    status: ticketStatusEnum("status").notNull().default("open"),
    priority: ticketPriorityEnum("priority").notNull().default("medium"),

    // Requester
    requesterId: text("requester_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),

    // Assignment
    assigneeId: text("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    departmentId: text("department_id").references(() => departments.id, {
      onDelete: "set null",
    }),
    categoryId: text("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    subcategoryId: text("subcategory_id").references(() => subcategories.id, {
      onDelete: "set null",
    }),

    // SLA
    slaPolicyId: text("sla_policy_id").references(() => slaPolicies.id, {
      onDelete: "set null",
    }),
    slaFirstResponseDue: timestamp("sla_first_response_due"),
    slaResolutionDue: timestamp("sla_resolution_due"),
    slaFirstResponseAt: timestamp("sla_first_response_at"),
    slaResolvedAt: timestamp("sla_resolved_at"),

    // Resolution
    resolvedAt: timestamp("resolved_at"),
    closedAt: timestamp("closed_at"),
    resolution: text("resolution"),

    // Reporter Information (Optional)
    reporterName: varchar("reporter_name", { length: 255 }),
    reporterAddress: text("reporter_address"),
    reporterMapUrl: text("reporter_map_url"),

    // Metadata
    source: varchar("source", { length: 50 }).default("web"),
    isRead: boolean("is_read").notNull().default(false),
    isDuplicate: boolean("is_duplicate").notNull().default(false),
    duplicateOfId: text("duplicate_of_id"),
    mergedIntoId: text("merged_into_id"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    ticketNumberIdx: uniqueIndex("tickets_number_idx").on(table.ticketNumber),
    requesterIdx: index("tickets_requester_idx").on(table.requesterId),
    assigneeIdx: index("tickets_assignee_idx").on(table.assigneeId),
    statusIdx: index("tickets_status_idx").on(table.status),
    priorityIdx: index("tickets_priority_idx").on(table.priority),
    departmentIdx: index("tickets_department_idx").on(table.departmentId),
    categoryIdx: index("tickets_category_idx").on(table.categoryId),
    createdAtIdx: index("tickets_created_at_idx").on(table.createdAt),
    slaResolutionDueIdx: index("tickets_sla_resolution_due_idx").on(
      table.slaResolutionDue
    ),
    deletedAtIdx: index("tickets_deleted_at_idx").on(table.deletedAt),
  })
);

// ─── Ticket Tags ──────────────────────────────────────────────────────────────

export const ticketTags = pgTable(
  "ticket_tags",
  {
    ticketId: text("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    pkIdx: uniqueIndex("ticket_tags_pk_idx").on(table.ticketId, table.tagId),
    ticketIdx: index("ticket_tags_ticket_idx").on(table.ticketId),
    tagIdx: index("ticket_tags_tag_idx").on(table.tagId),
  })
);

// ─── Ticket Status History ────────────────────────────────────────────────────

export const ticketStatusHistory = pgTable(
  "ticket_status_history",
  {
    id: text("id").primaryKey().$defaultFn(() => generateUuid()),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    fromStatus: ticketStatusEnum("from_status"),
    toStatus: ticketStatusEnum("to_status").notNull(),
    changedById: text("changed_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    reason: text("reason"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    ticketIdx: index("ticket_status_history_ticket_idx").on(table.ticketId),
    createdAtIdx: index("ticket_status_history_created_at_idx").on(
      table.createdAt
    ),
  })
);

// ─── Ticket Assignment History ────────────────────────────────────────────────

export const ticketAssignmentHistory = pgTable(
  "ticket_assignment_history",
  {
    id: text("id").primaryKey().$defaultFn(() => generateUuid()),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    fromAgentId: text("from_agent_id").references(() => users.id, {
      onDelete: "set null",
    }),
    toAgentId: text("to_agent_id").references(() => users.id, {
      onDelete: "set null",
    }),
    assignedById: text("assigned_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    reason: text("reason"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    ticketIdx: index("ticket_assignment_history_ticket_idx").on(table.ticketId),
  })
);

// ─── Ticket Messages ──────────────────────────────────────────────────────────

export const ticketMessages = pgTable(
  "ticket_messages",
  {
    id: text("id").primaryKey().$defaultFn(() => generateUuid()),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    content: text("content").notNull(),
    type: messageTypeEnum("type").notNull().default("public"),
    isFirstResponse: boolean("is_first_response").notNull().default(false),
    editedAt: timestamp("edited_at"),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    ticketIdx: index("ticket_messages_ticket_idx").on(table.ticketId),
    authorIdx: index("ticket_messages_author_idx").on(table.authorId),
    typeIdx: index("ticket_messages_type_idx").on(table.type),
    createdAtIdx: index("ticket_messages_created_at_idx").on(table.createdAt),
  })
);

// ─── Attachments ──────────────────────────────────────────────────────────────

export const attachments = pgTable(
  "attachments",
  {
    id: text("id").primaryKey().$defaultFn(() => generateUuid()),
    ticketId: text("ticket_id").references(() => tickets.id, {
      onDelete: "cascade",
    }),
    messageId: text("message_id").references(() => ticketMessages.id, {
      onDelete: "cascade",
    }),
    uploadedById: text("uploaded_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    // Original filename (sanitized)
    originalName: varchar("original_name", { length: 255 }).notNull(),
    // Stored as UUID-based filename
    storedName: varchar("stored_name", { length: 255 }).notNull().unique(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    size: bigint("size", { mode: "number" }).notNull(),
    // Full path on disk
    storagePath: text("storage_path").notNull(),
    // For image thumbnails
    thumbnailPath: text("thumbnail_path"),
    isDeleted: boolean("is_deleted").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    ticketIdx: index("attachments_ticket_idx").on(table.ticketId),
    messageIdx: index("attachments_message_idx").on(table.messageId),
    storedNameIdx: uniqueIndex("attachments_stored_name_idx").on(
      table.storedName
    ),
  })
);

// ─── Notifications ────────────────────────────────────────────────────────────

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey().$defaultFn(() => generateUuid()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    message: text("message").notNull(),
    ticketId: text("ticket_id").references(() => tickets.id, {
      onDelete: "cascade",
    }),
    data: jsonb("data"),
    isRead: boolean("is_read").notNull().default(false),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("notifications_user_idx").on(table.userId),
    isReadIdx: index("notifications_is_read_idx").on(table.isRead),
    ticketIdx: index("notifications_ticket_idx").on(table.ticketId),
    createdAtIdx: index("notifications_created_at_idx").on(table.createdAt),
  })
);

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id").primaryKey().$defaultFn(() => generateUuid()),
    actorId: text("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actorEmail: varchar("actor_email", { length: 255 }),
    action: auditActionEnum("action").notNull(),
    targetType: varchar("target_type", { length: 100 }),
    targetId: text("target_id"),
    metadata: jsonb("metadata"),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    actorIdx: index("audit_logs_actor_idx").on(table.actorId),
    actionIdx: index("audit_logs_action_idx").on(table.action),
    targetIdx: index("audit_logs_target_idx").on(table.targetType, table.targetId),
    createdAtIdx: index("audit_logs_created_at_idx").on(table.createdAt),
  })
);

// ─── System Settings ──────────────────────────────────────────────────────────

export const systemSettings = pgTable("system_settings", {
  id: text("id").primaryKey().$defaultFn(() => generateUuid()),
  key: varchar("key", { length: 255 }).notNull().unique(),
  value: text("value"),
  description: text("description"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Knowledge Base Articles ──────────────────────────────────────────────────

export const kbArticles = pgTable(
  "kb_articles",
  {
    id: text("id").primaryKey().$defaultFn(() => generateUuid()),
    title: varchar("title", { length: 500 }).notNull(),
    slug: varchar("slug", { length: 500 }).notNull().unique(),
    content: text("content").notNull(),
    excerpt: text("excerpt"),
    status: articleStatusEnum("status").notNull().default("draft"),
    categoryId: text("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    views: integer("views").notNull().default(0),
    helpfulCount: integer("helpful_count").notNull().default(0),
    notHelpfulCount: integer("not_helpful_count").notNull().default(0),
    publishedAt: timestamp("published_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    slugIdx: uniqueIndex("kb_articles_slug_idx").on(table.slug),
    statusIdx: index("kb_articles_status_idx").on(table.status),
    categoryIdx: index("kb_articles_category_idx").on(table.categoryId),
  })
);

// ─── SLA Events ───────────────────────────────────────────────────────────────

export const slaEvents = pgTable(
  "sla_events",
  {
    id: text("id").primaryKey().$defaultFn(() => generateUuid()),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    slaPolicyId: text("sla_policy_id").references(() => slaPolicies.id, {
      onDelete: "set null",
    }),
    eventType: varchar("event_type", { length: 50 }).notNull(), // 'first_response_warning', 'first_response_breach', 'resolution_warning', 'resolution_breach'
    dueAt: timestamp("due_at").notNull(),
    triggeredAt: timestamp("triggered_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    ticketIdx: index("sla_events_ticket_idx").on(table.ticketId),
    dueAtIdx: index("sla_events_due_at_idx").on(table.dueAt),
  })
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many, one }) => ({
  department: one(departments, {
    fields: [users.departmentId],
    references: [departments.id],
  }),
  requestedTickets: many(tickets, { relationName: "requester" }),
  assignedTickets: many(tickets, { relationName: "assignee" }),
  messages: many(ticketMessages),
  notifications: many(notifications),
  auditLogs: many(auditLogs),
}));

export const departmentsRelations = relations(departments, ({ many }) => ({
  users: many(users),
  tickets: many(tickets),
  categories: many(categories),
  slaPolicies: many(slaPolicies),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  department: one(departments, {
    fields: [categories.departmentId],
    references: [departments.id],
  }),
  subcategories: many(subcategories),
  tickets: many(tickets),
}));

export const subcategoriesRelations = relations(
  subcategories,
  ({ one, many }) => ({
    category: one(categories, {
      fields: [subcategories.categoryId],
      references: [categories.id],
    }),
    tickets: many(tickets),
  })
);

export const ticketsRelations = relations(tickets, ({ one, many }) => ({
  requester: one(users, {
    fields: [tickets.requesterId],
    references: [users.id],
    relationName: "requester",
  }),
  assignee: one(users, {
    fields: [tickets.assigneeId],
    references: [users.id],
    relationName: "assignee",
  }),
  department: one(departments, {
    fields: [tickets.departmentId],
    references: [departments.id],
  }),
  category: one(categories, {
    fields: [tickets.categoryId],
    references: [categories.id],
  }),
  subcategory: one(subcategories, {
    fields: [tickets.subcategoryId],
    references: [subcategories.id],
  }),
  slaPolicy: one(slaPolicies, {
    fields: [tickets.slaPolicyId],
    references: [slaPolicies.id],
  }),
  messages: many(ticketMessages),
  attachments: many(attachments),
  tags: many(ticketTags),
  statusHistory: many(ticketStatusHistory),
  assignmentHistory: many(ticketAssignmentHistory),
  notifications: many(notifications),
  slaEvents: many(slaEvents),
}));

export const ticketStatusHistoryRelations = relations(
  ticketStatusHistory,
  ({ one }) => ({
    ticket: one(tickets, {
      fields: [ticketStatusHistory.ticketId],
      references: [tickets.id],
    }),
    changedBy: one(users, {
      fields: [ticketStatusHistory.changedById],
      references: [users.id],
    }),
  })
);

export const ticketAssignmentHistoryRelations = relations(
  ticketAssignmentHistory,
  ({ one }) => ({
    ticket: one(tickets, {
      fields: [ticketAssignmentHistory.ticketId],
      references: [tickets.id],
    }),
    fromAgent: one(users, {
      fields: [ticketAssignmentHistory.fromAgentId],
      references: [users.id],
      relationName: "fromAgent",
    }),
    toAgent: one(users, {
      fields: [ticketAssignmentHistory.toAgentId],
      references: [users.id],
      relationName: "toAgent",
    }),
    assignedBy: one(users, {
      fields: [ticketAssignmentHistory.assignedById],
      references: [users.id],
      relationName: "assignedBy",
    }),
  })
);

export const ticketMessagesRelations = relations(
  ticketMessages,
  ({ one, many }) => ({
    ticket: one(tickets, {
      fields: [ticketMessages.ticketId],
      references: [tickets.id],
    }),
    author: one(users, {
      fields: [ticketMessages.authorId],
      references: [users.id],
    }),
    attachments: many(attachments),
  })
);

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  ticket: one(tickets, {
    fields: [attachments.ticketId],
    references: [tickets.id],
  }),
  message: one(ticketMessages, {
    fields: [attachments.messageId],
    references: [ticketMessages.id],
  }),
  uploadedBy: one(users, {
    fields: [attachments.uploadedById],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  ticket: one(tickets, {
    fields: [notifications.ticketId],
    references: [tickets.id],
  }),
}));

export const ticketTagsRelations = relations(ticketTags, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketTags.ticketId],
    references: [tickets.id],
  }),
  tag: one(tags, {
    fields: [ticketTags.tagId],
    references: [tags.id],
  }),
}));

export const slaPoliciesRelations = relations(slaPolicies, ({ one, many }) => ({
  department: one(departments, {
    fields: [slaPolicies.departmentId],
    references: [departments.id],
  }),
  tickets: many(tickets),
  slaEvents: many(slaEvents),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, {
    fields: [auditLogs.actorId],
    references: [users.id],
  }),
}));

export const kbArticlesRelations = relations(kbArticles, ({ one }) => ({
  author: one(users, {
    fields: [kbArticles.authorId],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [kbArticles.categoryId],
    references: [categories.id],
  }),
}));

// ─── Type Exports ─────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;
export type TicketMessage = typeof ticketMessages.$inferSelect;
export type NewTicketMessage = typeof ticketMessages.$inferInsert;
export type Attachment = typeof attachments.$inferSelect;
export type NewAttachment = typeof attachments.$inferInsert;
export type Department = typeof departments.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Subcategory = typeof subcategories.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type SlaPolicy = typeof slaPolicies.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type KbArticle = typeof kbArticles.$inferSelect;
export type TicketStatusHistory = typeof ticketStatusHistory.$inferSelect;
export type TicketAssignmentHistory = typeof ticketAssignmentHistory.$inferSelect;
