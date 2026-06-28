import { create } from 'zustand';
import { db } from '@/db/client';
import { staffUsers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { sha256 } from '@/lib/crypto';
import { syncWithCloud } from '@/lib/sync';

export interface User {
  id: string;
  name: string;
  role: 'owner' | 'staff';
  pinHash: string;
  isActive: number;
  isSynced: number;
  createdAt: number;
}

interface AuthState {
  currentUser: User | null;
  staffList: User[];
  isInitialized: boolean; // true if an owner is registered
  isLoading: boolean;
  
  initializeAuth: () => Promise<void>;
  login: (pin: string) => Promise<boolean>;
  logout: () => void;
  createOwner: (name: string, pin: string) => Promise<boolean>;
  addStaff: (name: string, pin: string, role: 'owner' | 'staff') => Promise<boolean>;
  deactivateStaff: (id: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  currentUser: null,
  staffList: [],
  isInitialized: false,
  isLoading: true,

  initializeAuth: async () => {
    try {
      set({ isLoading: true });
      const users = db.select().from(staffUsers).where(eq(staffUsers.isActive, 1)).all();
      
      const hasOwner = users.some(u => u.role === 'owner');
      set({ 
        staffList: users as User[], 
        isInitialized: hasOwner,
        isLoading: false 
      });
    } catch (error) {
      console.error('Failed to initialize auth state:', error);
      set({ isLoading: false });
    }
  },

  login: async (pin: string) => {
    try {
      const users = db.select().from(staffUsers).where(eq(staffUsers.isActive, 1)).all();
      
      // 1. Try matching with salted PIN hash (sha256(pin + id))
      let matchedUser = users.find(u => u.pinHash === sha256(pin + u.id));
      
      if (matchedUser) {
        set({ currentUser: matchedUser as User });
        return true;
      }

      // 2. Try fallback matching with unsalted PIN hash (for backward compatibility)
      const unsaltedHash = sha256(pin);
      matchedUser = users.find(u => u.pinHash === unsaltedHash);
      if (matchedUser) {
        // Auto-upgrade this user's pin hash to salted version
        const saltedHash = sha256(pin + matchedUser.id);
        await db.update(staffUsers)
          .set({ pinHash: saltedHash, isSynced: 0, updatedAt: Date.now() })
          .where(eq(staffUsers.id, matchedUser.id))
          .run();
        syncWithCloud().catch((e) => console.error('[useAuthStore] Auto sync error:', e));
        
        // Update local memory reference
        matchedUser.pinHash = saltedHash;
        set({ currentUser: matchedUser as User });
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  },

  logout: () => {
    set({ currentUser: null });
  },

  createOwner: async (name: string, pin: string) => {
    try {
      const ownerId = `staff_${Date.now()}`;
      const hashed = sha256(pin + ownerId);
      const now = Date.now();
      
      const newOwner = {
        id: ownerId,
        name,
        role: 'owner' as const,
        pinHash: hashed,
        isActive: 1,
        isSynced: 0,
        createdAt: now,
        updatedAt: now,
      };

      await db.insert(staffUsers).values(newOwner).run();
      await get().initializeAuth();
      set({ currentUser: newOwner });
      syncWithCloud().catch((e) => console.error('[useAuthStore] Auto sync error:', e));
      return true;
    } catch (error) {
      console.error('Failed to create owner account:', error);
      return false;
    }
  },

  addStaff: async (name: string, pin: string, role: 'owner' | 'staff') => {
    try {
      const staffId = `staff_${Date.now()}`;
      const hashed = sha256(pin + staffId);
      const now = Date.now();

      const newStaff = {
        id: staffId,
        name,
        role,
        pinHash: hashed,
        isActive: 1,
        isSynced: 0,
        createdAt: now,
        updatedAt: now,
      };

      await db.insert(staffUsers).values(newStaff).run();
      await get().initializeAuth();
      syncWithCloud().catch((e) => console.error('[useAuthStore] Auto sync error:', e));
      return true;
    } catch (error) {
      console.error('Failed to add staff account:', error);
      return false;
    }
  },

  deactivateStaff: async (id: string) => {
    try {
      await db.update(staffUsers)
        .set({ isActive: 0, isSynced: 0, updatedAt: Date.now() })
        .where(eq(staffUsers.id, id))
        .run();

      await get().initializeAuth();
      syncWithCloud().catch((e) => console.error('[useAuthStore] Auto sync error:', e));
    } catch (error) {
      console.error('Failed to deactivate staff user:', error);
    }
  },
}));
