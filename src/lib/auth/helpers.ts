import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export type UserRole = "admin" | "agent" | "user";

export async function getSession() {
  const session = await auth();
  return session;
}

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}

export async function requireRole(roles: UserRole[]) {
  const session = await requireAuth();
  const userRole = (session.user as any).role as UserRole;
  if (!roles.includes(userRole)) {
    redirect("/unauthorized");
  }
  return session;
}

export async function requireAdmin() {
  return requireRole(["admin"]);
}

export async function requireAgentOrAdmin() {
  return requireRole(["admin", "agent"]);
}

export function isAdmin(role: string): boolean {
  return role === "admin";
}

export function isAgent(role: string): boolean {
  return role === "agent" || role === "admin";
}

export function isUser(role: string): boolean {
  return role === "user";
}

// Check if user can access ticket (Shared links: all authenticated users can view tickets)
export function canAccessTicket(
  userRole: string,
  userId: string,
  ticketRequesterId: string,
  ticketAssigneeId: string | null
): boolean {
  // Any authenticated user can view the ticket details and public thread
  return true;
}

// Check if user can reply to a ticket
export function canReplyToTicket(
  userRole: string,
  userId: string,
  ticketRequesterId: string,
  ticketAssigneeId: string | null
): boolean {
  if (userRole === "admin" || userRole === "agent") return true;
  return userId === ticketRequesterId;
}

// Check if user can modify ticket (status, assignment, priority, deletion, edit)
export function canModifyTicket(
  userRole: string,
  userId: string,
  ticketRequesterId: string,
  ticketAssigneeId: string | null
): boolean {
  if (userRole === "admin") return true;
  if (userRole === "agent") return true;
  return false;
}

// Check if user can write internal notes
export function canWriteInternalNotes(userRole: string): boolean {
  return userRole === "admin" || userRole === "agent";
}
