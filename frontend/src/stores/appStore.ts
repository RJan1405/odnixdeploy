import { create } from 'zustand';

interface AppState {
  isUploadModalOpen: boolean;
  uploadType: 'scribe' | 'omzo' | 'story' | null;
  activeTab: 'all' | 'private';
  notificationsOpen: boolean;

  openUploadModal: (type: 'scribe' | 'omzo' | 'story') => void;
  closeUploadModal: () => void;
  setActiveTab: (tab: 'all' | 'private') => void;
  toggleNotifications: () => void;
  refreshTrigger: number;
  triggerRefresh: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  isUploadModalOpen: false,
  uploadType: null,
  activeTab: 'all',
  notificationsOpen: false,
  refreshTrigger: 0,

  openUploadModal: (type) => set({ isUploadModalOpen: true, uploadType: type }),
  closeUploadModal: () => set({ isUploadModalOpen: false, uploadType: null }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  toggleNotifications: () => set((state) => ({ notificationsOpen: !state.notificationsOpen })),
  triggerRefresh: () => set((state) => ({ refreshTrigger: state.refreshTrigger + 1 })),
}));
