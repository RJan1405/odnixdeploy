import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, X, Camera, Lock, User as UserIcon, Palette, Check } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeStore } from '@/stores/themeStore';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLogout: () => void;
    onProfileUpdate: () => void;
}

const themes = [
    { id: 'light', name: 'Light', preview: 'bg-white border-2 border-gray-200' },
    { id: 'dark', name: 'Dark', preview: 'bg-slate-900 border-2 border-slate-700' },
    { id: 'amoled', name: 'AMOLED', preview: 'bg-black border-2 border-gray-800' },
    { id: 'dracula', name: 'Dracula', preview: 'bg-[#282a36] border-2 border-[#44475a]' },
    { id: 'nord', name: 'Nord', preview: 'bg-[#2e3440] border-2 border-[#4c566a]' },
    { id: 'cyberpunk', name: 'Cyberpunk', preview: 'bg-[#0f0b1e] border-2 border-[#f0f]' },
    { id: 'synthwave', name: 'Synthwave', preview: 'bg-[#1a1426] border-2 border-[#ff71ce]' },
] as const;

export function SettingsModal({ isOpen, onClose, onLogout, onProfileUpdate }: SettingsModalProps) {
    const { user } = useAuth();
    const { theme, setTheme } = useThemeStore();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Form State
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [username, setUsername] = useState('');
    const [isPrivate, setIsPrivate] = useState(false);
    const [previewImage, setPreviewImage] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    // UI State
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'profile' | 'appearance'>('profile');

    // Load initial data
    useEffect(() => {
        if (isOpen && user) {
            const parts = (user.displayName || '').split(' ');
            setFirstName(parts[0] || '');
            setLastName(parts.slice(1).join(' ') || '');
            setUsername(user.username || '');
            setIsPrivate(user.isPrivate || false);
            setPreviewImage(user.avatar || '');
            setSelectedFile(null);
        }
    }, [isOpen, user]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setSelectedFile(file);
        const url = URL.createObjectURL(file);
        setPreviewImage(url);
    };

    const handleSave = async () => {
        if (!user) return;
        setIsLoading(true);

        try {
            const formData = new FormData();

            // Append Profile Data
            formData.append('first_name', firstName);
            formData.append('last_name', lastName);
            // formData.append('username', username); // Typically username isn't changeable or handled carefully
            if (selectedFile) {
                formData.append('avatar', selectedFile);
            }
            formData.append('is_private', isPrivate.toString());

            const updatedUser = await api.updateProfile(formData);

            if (updatedUser) {
                onProfileUpdate();
                onClose();
            } else {
                // Handle error
            }
        } catch (error) {
            console.error('Failed to update profile', error);
        } finally {
            setIsLoading(false);
        }
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
                    className="w-full max-w-lg bg-background rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-xl max-h-[90vh] flex flex-col"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-border">
                        <h2 className="text-lg font-semibold text-foreground">Settings</h2>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-secondary rounded-full transition-colors"
                        >
                            <X className="w-5 h-5 text-muted-foreground" />
                        </button>
                    </div>

                    {/* Tabs - Optional, but organizes content cleanly */}
                    {/* <div className="flex border-b border-border">
                        <button 
                            onClick={() => setActiveTab('profile')}
                            className={cn(
                                "flex-1 py-3 text-sm font-medium border-b-2 transition-colors",
                                activeTab === 'profile' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Profile
                        </button>
                        <button 
                            onClick={() => setActiveTab('appearance')}
                            className={cn(
                                "flex-1 py-3 text-sm font-medium border-b-2 transition-colors",
                                activeTab === 'appearance' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Appearance
                        </button>
                    </div> */}

                    {/* Content - Scrollable */}
                    <div className="overflow-y-auto p-4 space-y-6 flex-1">

                        {/* Profile Photo */}
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <img
                                    src={previewImage || 'https://via.placeholder.com/100'}
                                    alt="Profile"
                                    className="w-20 h-20 rounded-full object-cover border-2 border-border"
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="absolute bottom-0 right-0 p-1.5 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-colors"
                                >
                                    <Camera className="w-4 h-4" />
                                </button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    className="hidden"
                                    accept="image/*"
                                />
                            </div>
                            <div>
                                <h3 className="font-medium text-foreground">Profile Photo</h3>
                                <p className="text-sm text-muted-foreground">Upload a new avatar</p>
                            </div>
                        </div>

                        <div className="h-px bg-border" />

                        {/* Personal Info */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                <UserIcon className="w-4 h-4" /> Personal Information
                            </h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="firstName">First Name</Label>
                                    <Input
                                        id="firstName"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        className="bg-secondary/50 border-input"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="lastName">Last Name</Label>
                                    <Input
                                        id="lastName"
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        className="bg-secondary/50 border-input"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="username">Username</Label>
                                <Input
                                    id="username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)} // Note: API might not support username change
                                    className="bg-secondary/50 border-input"
                                    disabled // Disable for now unless API supports it
                                />
                                <p className="text-xs text-muted-foreground">Username cannot be changed directly.</p>
                            </div>
                        </div>

                        <div className="h-px bg-border" />

                        {/* Privacy */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                <Lock className="w-4 h-4" /> Privacy
                            </h4>
                            <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Private Account</Label>
                                    <p className="text-xs text-muted-foreground">Only followers can see your posts</p>
                                </div>
                                <Switch
                                    checked={isPrivate}
                                    onCheckedChange={setIsPrivate}
                                />
                            </div>
                        </div>

                        <div className="h-px bg-border" />

                        {/* Appearance */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                <Palette className="w-4 h-4" /> Appearance
                            </h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {themes.map((t) => (
                                    <button
                                        key={t.id}
                                        onClick={() => setTheme(t.id)}
                                        className={cn(
                                            "flex items-center gap-2 p-2 rounded-lg border transition-all text-left",
                                            theme === t.id
                                                ? "bg-primary/10 border-primary"
                                                : "bg-secondary/30 border-transparent hover:bg-secondary/50"
                                        )}
                                    >
                                        <div className={cn("w-4 h-4 rounded-full", t.preview)} />
                                        <span className={cn(
                                            "text-xs font-medium",
                                            theme === t.id ? "text-primary" : "text-foreground"
                                        )}>
                                            {t.name}
                                        </span>
                                        {theme === t.id && <Check className="w-3 h-3 ml-auto text-primary" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="h-px bg-border" />

                        {/* Logout */}
                        <button
                            onClick={onLogout}
                            className="w-full p-4 flex items-center justify-between hover:bg-red-500/10 transition-colors rounded-xl border border-transparent hover:border-red-500/20 group"
                        >
                            <span className="font-medium text-red-500 group-hover:text-red-400">Log Out</span>
                            <LogOut className="w-5 h-5 text-red-500 group-hover:text-red-400" />
                        </button>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-border bg-background/50 backdrop-blur-sm">
                        <button
                            onClick={handleSave}
                            disabled={isLoading}
                            className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isLoading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>

                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
