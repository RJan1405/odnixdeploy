import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/services/api';
import {
    Reply,
    Copy,
    Forward,
    Star,
    Trash2,
    Edit,
    Download,
    Info,
    Pin,
    CheckCheck,
} from 'lucide-react';

interface ContextMenuOption {
    id: string;
    label: string;
    icon: string;
    action: string;
    destructive?: boolean;
    divider?: boolean;
}

interface MessageContextMenuProps {
    messageId: string;
    chatId: string;
    isOwn: boolean;
    position: { x: number; y: number };
    onClose: () => void;
    onAction: (action: string, messageId: string) => void;
}

const iconMap: Record<string, React.ReactNode> = {
    reply: <Reply className="w-4 h-4" />,
    copy: <Copy className="w-4 h-4" />,
    forward: <Forward className="w-4 h-4" />,
    star: <Star className="w-4 h-4" />,
    delete: <Trash2 className="w-4 h-4" />,
    edit: <Edit className="w-4 h-4" />,
    download: <Download className="w-4 h-4" />,
    info: <Info className="w-4 h-4" />,
    pin: <Pin className="w-4 h-4" />,
    select: <CheckCheck className="w-4 h-4" />,
};

export function MessageContextMenu({
    messageId,
    chatId,
    isOwn,
    position,
    onClose,
    onAction,
}: MessageContextMenuProps) {
    const [options, setOptions] = useState<ContextMenuOption[]>([]);
    const [loading, setLoading] = useState(true);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Fetch context menu options from backend
        const fetchOptions = async () => {
            try {
                const data = await api.getMessageContextMenu(messageId, chatId, isOwn);
                setOptions(data.options || []);
            } catch (error) {
                console.error('Error fetching context menu options:', error);
                // Fallback to default options
                setOptions(getDefaultOptions(isOwn));
            } finally {
                setLoading(false);
            }
        };

        fetchOptions();
    }, [messageId, chatId, isOwn]);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    // Close menu on escape key
    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    const handleOptionClick = async (option: ContextMenuOption) => {
        onAction(option.action, messageId);
        onClose();
    };

    // Adjust position to keep menu on screen
    const adjustedPosition = {
        x: Math.min(position.x, window.innerWidth - 220),
        y: Math.min(position.y, window.innerHeight - (options.length * 40 + 20)),
    };

    if (loading) {
        return null;
    }

    return (
        <AnimatePresence>
            <motion.div
                ref={menuRef}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.1 }}
                className="fixed z-50 bg-background border border-border rounded-lg shadow-lg overflow-hidden min-w-[200px]"
                style={{
                    left: `${adjustedPosition.x}px`,
                    top: `${adjustedPosition.y}px`,
                }}
            >
                {options.map((option, index) => (
                    <React.Fragment key={option.id}>
                        {option.divider && index > 0 && (
                            <div className="h-px bg-border my-1" />
                        )}
                        <button
                            onClick={() => handleOptionClick(option)}
                            className={`
                w-full flex items-center gap-3 px-4 py-2.5 text-sm
                transition-colors text-left
                ${option.destructive
                                    ? 'text-destructive hover:bg-destructive/10'
                                    : 'text-foreground hover:bg-secondary'
                                }
              `}
                        >
                            <span className={option.destructive ? 'text-destructive' : 'text-muted-foreground'}>
                                {iconMap[option.icon] || <Info className="w-4 h-4" />}
                            </span>
                            <span className="flex-1">{option.label}</span>
                        </button>
                    </React.Fragment>
                ))}
            </motion.div>
        </AnimatePresence>
    );
}

// Fallback default options if backend fails
function getDefaultOptions(isOwn: boolean): ContextMenuOption[] {
    const baseOptions: ContextMenuOption[] = [
        { id: '1', label: 'Reply', icon: 'reply', action: 'reply' },
        { id: '2', label: 'Copy', icon: 'copy', action: 'copy' },
        { id: '3', label: 'Forward', icon: 'forward', action: 'forward' },
        { id: '4', label: 'Star', icon: 'star', action: 'star' },
    ];

    if (isOwn) {
        baseOptions.push(
            { id: '5', label: 'Edit', icon: 'edit', action: 'edit', divider: true },
            { id: '6', label: 'Delete', icon: 'delete', action: 'delete', destructive: true }
        );
    } else {
        baseOptions.push(
            { id: '7', label: 'Info', icon: 'info', action: 'info', divider: true }
        );
    }

    return baseOptions;
}
