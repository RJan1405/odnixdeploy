import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, X, Moon, Sun, Camera } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';
import { api } from '@/services/api';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLogout: () => void;
    onProfileUpdate: () => void;
}

export function SettingsModal({ isOpen, onClose, onLogout, onProfileUpdate }: SettingsModalProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        setIsDark(document.documentElement.classList.contains('dark'));
    }, []);

    const toggleTheme = () => {
        const newTheme = !isDark;
        setIsDark(newTheme);
        if (newTheme) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append('avatar', file);

        const updatedUser = await api.updateProfile(formData);
        if (updatedUser) {
            onProfileUpdate(); // This should trigger reload in parent
            onClose();
        } else {
            alert('Failed to update profile picture');
        }
        setIsUploading(false);
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-md bg-background rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-xl"
                >
                    {/* Header */}
                    <div className="flex items-center justify-center p-4 border-b border-border relative">
                        <div className="w-12 h-1 bg-muted rounded-full absolute top-2 sm:hidden" />
                        <span className="font-semibold text-foreground mt-2 sm:mt-0">Settings</span>
                        <button
                            onClick={onClose}
                            className="hidden sm:block absolute right-4 p-2 hover:bg-secondary rounded-full transition-colors"
                        >
                            <X className="w-5 h-5 text-muted-foreground" />
                        </button>
                    </div>

                    <div className="p-2">
                        {/* Change Profile Photo */}
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className="w-full p-4 flex items-center gap-3 hover:bg-secondary/50 transition-colors text-left rounded-xl"
                        >
                            <div className="p-2 bg-secondary rounded-full">
                                <Camera className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex-1">
                                <p className="font-medium text-foreground">Change Profile Photo</p>
                                <p className="text-sm text-muted-foreground">Upload a new avatar</p>
                            </div>
                            {isUploading && <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />}
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            className="hidden"
                            accept="image/*"
                        />

                        {/* Theme Toggle */}
                        <button
                            onClick={toggleTheme}
                            className="w-full p-4 flex items-center gap-3 hover:bg-secondary/50 transition-colors text-left rounded-xl"
                        >
                            <div className="p-2 bg-secondary rounded-full">
                                {isDark ? <Moon className="w-5 h-5 text-purple-400" /> : <Sun className="w-5 h-5 text-amber-400" />}
                            </div>
                            <div className="flex-1">
                                <p className="font-medium text-foreground">Appearance</p>
                                <p className="text-sm text-muted-foreground">{isDark ? 'Dark Mode' : 'Light Mode'}</p>
                            </div>
                        </button>

                        <div className="h-px bg-border my-2 mx-4" />

                        {/* Logout */}
                        <button
                            onClick={onLogout}
                            className="w-full p-4 flex items-center gap-3 hover:bg-red-500/10 transition-colors text-left rounded-xl group"
                        >
                            <div className="p-2 bg-red-500/10 group-hover:bg-red-500/20 rounded-full transition-colors">
                                <LogOut className="w-5 h-5 text-red-500" />
                            </div>
                            <p className="font-medium text-red-500">Log Out</p>
                        </button>
                    </div>

                    <div className="p-4 pt-0">
                        <button onClick={onClose} className="w-full py-3 bg-secondary rounded-xl font-medium text-foreground sm:hidden">
                            Cancel
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
