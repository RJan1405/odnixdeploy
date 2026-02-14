
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/Avatar';
import { api, User } from '@/services/api';
import { Loader2, Camera, X, Search } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

interface NewGroupModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function NewGroupModal({ isOpen, onClose }: NewGroupModalProps) {
    const { toast } = useToast();
    const navigate = useNavigate();

    const [groupName, setGroupName] = useState('');
    const [description, setDescription] = useState('');
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setGroupName('');
            setDescription('');
            setAvatarFile(null);
            setAvatarPreview(null);
            setSearchQuery('');
            setSearchResults([]);
            setSelectedUsers([]);
            setIsCreating(false);
        }
    }, [isOpen]);

    // Search users
    useEffect(() => {
        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const users = await api.searchUsersPublic(searchQuery);
                // Filter out already selected users
                const filtered = users.filter((u) => !selectedUsers.find((s) => s.id === u.id));
                setSearchResults(filtered);
            } catch (error) {
                console.error("Search error", error);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery, selectedUsers]);

    const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAvatarFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatarPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const toggleUser = (user: User) => {
        if (selectedUsers.find((u) => u.id === user.id)) {
            setSelectedUsers(selectedUsers.filter((u) => u.id !== user.id));
        } else {
            setSelectedUsers([...selectedUsers, user]);
            setSearchResults(searchResults.filter((u) => u.id !== user.id));
            setSearchQuery('');
        }
    };

    const removeUser = (userId: string) => {
        setSelectedUsers(selectedUsers.filter((u) => u.id !== userId));
    };

    const handleCreateGroup = async () => {
        if (!groupName.trim()) {
            toast({
                title: "Group name required",
                description: "Please enter a name for the group.",
                variant: "destructive"
            });
            return;
        }
        if (selectedUsers.length < 1) {
            toast({
                title: "Add participants",
                description: "Please select at least one member.",
                variant: "destructive"
            });
            return;
        }

        setIsCreating(true);
        try {
            const participantIds = selectedUsers.map((u) => u.id);
            const newGroup = await api.createGroup(groupName, participantIds, description, false, avatarFile);

            if (newGroup && newGroup.id) {
                toast({
                    title: "Success",
                    description: "Group created successfully!",
                });
                onClose();
                navigate(`/chat/${newGroup.id}`);
            } else {
                throw new Error("Failed to create group");
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to create group. Please try again.",
                variant: "destructive"
            });
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-hidden flex flex-col p-6 bg-background/95 backdrop-blur-xl border-white/10">
                <DialogHeader>
                    <DialogTitle>Create New Group</DialogTitle>
                    <DialogDescription>
                        Create a group to chat with multiple people at once.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto pr-1 space-y-6 py-4">
                    {/* Avatar Upload */}
                    <div className="flex justify-center">
                        <div
                            className="relative group cursor-pointer"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <div className={cn(
                                "w-24 h-24 rounded-full flex items-center justify-center overflow-hidden border-2 transition-all",
                                avatarPreview ? "border-primary" : "border-dashed border-muted-foreground/30 bg-muted"
                            )}>
                                {avatarPreview ? (
                                    <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <Camera className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
                                )}
                            </div>
                            <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <Camera className="w-6 h-6 text-white" />
                            </div>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleAvatarSelect}
                        />
                    </div>

                    {/* Inputs */}
                    <div className="space-y-4">
                        <Input
                            placeholder="Group Name"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            className="bg-secondary/50 border-transparent focus-visible:bg-secondary/80"
                        />
                        <Input
                            placeholder="Description (Optional)"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="bg-secondary/50 border-transparent focus-visible:bg-secondary/80"
                        />
                    </div>

                    {/* Participants */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium text-muted-foreground">Participants</h3>
                            <span className="text-xs text-muted-foreground">{selectedUsers.length} selected</span>
                        </div>

                        {selectedUsers.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2">
                                {selectedUsers.map(user => (
                                    <div key={user.id} className="flex items-center gap-1.5 bg-secondary/80 rounded-full pl-1 pr-2 py-0.5 animate-in fade-in zoom-in duration-200">
                                        <Avatar src={user.avatar} alt={user.username} className="w-5 h-5" />
                                        <span className="text-xs font-medium">{user.displayName}</span>
                                        <button onClick={() => removeUser(user.id)} className="hover:bg-destructive/20 rounded-full p-0.5 transition-colors">
                                            <X className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search users..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 bg-secondary/30 border-transparent focus-visible:bg-secondary/50 rounded-xl"
                            />
                        </div>

                        <div className="space-y-1 mt-2">
                            {isSearching ? (
                                <div className="flex justify-center py-2">
                                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                </div>
                            ) : searchResults.length > 0 ? (
                                searchResults.map(user => (
                                    <button
                                        key={user.id}
                                        onClick={() => toggleUser(user)}
                                        className="w-full flex items-center gap-3 p-2 hover:bg-secondary/40 rounded-lg transition-colors group text-left"
                                    >
                                        <Avatar src={user.avatar} alt={user.username} className="w-8 h-8" />
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-medium truncate">{user.displayName}</h4>
                                            <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
                                        </div>
                                        <div className="w-5 h-5 rounded-full border border-muted-foreground/30 flex items-center justify-center group-hover:border-primary transition-colors">
                                            {selectedUsers.find(u => u.id === user.id) && (
                                                <div className="w-3 h-3 bg-primary rounded-full" />
                                            )}
                                        </div>
                                    </button>
                                ))
                            ) : (
                                <p className="text-center text-xs text-muted-foreground py-2">
                                    {searchQuery ? "No users found" : "No suggested users found"}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <DialogFooter className="pt-2">
                    <Button variant="outline" onClick={onClose} disabled={isCreating}>Cancel</Button>
                    <Button
                        onClick={handleCreateGroup}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground"
                        disabled={!groupName.trim() || selectedUsers.length === 0 || isCreating}
                    >
                        {isCreating ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Creating...
                            </>
                        ) : 'Create Group'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
