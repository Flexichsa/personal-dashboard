// Password types
export interface PasswordEntry {
  id: string;
  title: string;
  username: string;
  password: string;
  url?: string;
  category?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

// Contact types
export interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  tags: string[];
  avatar?: string;
  notes?: string;
  createdAt: number;
}

// Note types
export interface Note {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  color?: string;
  createdAt: number;
  updatedAt: number;
}

// Bookmark types
export interface Bookmark {
  id: string;
  title: string;
  url: string;
  category?: string;
  favicon?: string;
  createdAt: number;
}

// Calendar types
export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  color?: string;
  description?: string;
}

// Todo types
export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
  createdAt: number;
}

// Sticky Note types
export interface StickyNote {
  id: string;
  content: string;
  color: string;
  createdAt: number;
}

// Finance types
export interface FinanceEntry {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date: string;
  createdAt: number;
}

// World Clock types
export interface WorldClock {
  id: string;
  label: string;
  timezone: string;
}

// File types
export interface FileEntry {
  id: string;
  name: string;
  size: number;
  type: string;
  storagePath: string;
  createdAt: number;
}

// Hardware types
export interface HardwareDevice {
  id: string;
  name: string;
  type: 'smartphone' | 'laptop' | 'tablet' | 'desktop' | 'smartwatch' | 'other';
  assignedTo?: string;
  manufacturer?: string;
  model?: string;
  imei?: string;
  serialNumber?: string;
  cpu?: string;
  ram?: string;
  storage?: string;
  os?: string;
  screenSize?: string;
  specs?: string;
  purchaseDate?: string;
  warrantyUntil?: string;
  notes?: string;
  photoPaths: string[];
  createdAt: number;
}

// Work Instruction types
export interface WorkAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  storagePath: string;
}

export interface WorkInstruction {
  id: string;
  title: string;
  description: string;
  attachments: WorkAttachment[];
  createdAt: number;
  updatedAt: number;
}

// Widget layout
export interface WidgetConfig {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}
