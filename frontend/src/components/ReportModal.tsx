import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, Flag } from 'lucide-react';
import { api } from '@/services/api';

interface ReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    contentType: 'scribe' | 'omzo';
    contentId: string;
    onReportSuccess?: () => void;
}

const REPORT_REASONS = [
    { value: 'spam', label: 'Spam', description: 'Repetitive or misleading content' },
    { value: 'inappropriate', label: 'Inappropriate Content', description: 'Offensive or unsuitable material' },
    { value: 'harassment', label: 'Harassment or Bullying', description: 'Targeting or attacking others' },
    { value: 'violence', label: 'Violence or Threats', description: 'Promoting or threatening violence' },
    { value: 'hate_speech', label: 'Hate Speech', description: 'Discriminatory or hateful content' },
    { value: 'false_info', label: 'False Information', description: 'Misinformation or fake news' },
    { value: 'copyright', label: 'Copyright Infringement', description: 'Unauthorized use of copyrighted material' },
    { value: 'other', label: 'Other', description: 'Other violations' },
];

const COPYRIGHT_TYPES = [
    { value: 'audio', label: 'Audio Copyright' },
    { value: 'content', label: 'Content Copyright' },
    { value: 'both', label: 'Both Audio and Content' },
];

export function ReportModal({ isOpen, onClose, contentType, contentId, onReportSuccess }: ReportModalProps) {
    const [selectedReason, setSelectedReason] = useState('');
    const [description, setDescription] = useState('');
    const [copyrightDescription, setCopyrightDescription] = useState('');
    const [copyrightType, setCopyrightType] = useState<'audio' | 'content' | 'both'>('audio');
    const [disableAudio, setDisableAudio] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedReason) {
            setError('Please select a reason for reporting');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            let result;

            if (contentType === 'scribe') {
                result = await api.reportPost(
                    contentId,
                    selectedReason,
                    description,
                    selectedReason === 'copyright' ? copyrightDescription : undefined,
                    selectedReason === 'copyright' ? copyrightType : undefined
                );
            } else {
                result = await api.reportOmzo(
                    contentId,
                    selectedReason,
                    description,
                    selectedReason === 'copyright' ? copyrightDescription : undefined,
                    selectedReason === 'copyright' ? copyrightType : undefined,
                    selectedReason === 'copyright' ? disableAudio : undefined
                );
            }

            if (result.success) {
                setSuccess(true);
                setTimeout(() => {
                    onReportSuccess?.();
                    handleClose();
                }, 2000);
            } else {
                setError(result.error || 'Failed to submit report');
            }
        } catch (err) {
            setError('An error occurred while submitting the report');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setSelectedReason('');
        setDescription('');
        setCopyrightDescription('');
        setCopyrightType('audio');
        setDisableAudio(false);
        setError('');
        setSuccess(false);
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[55] flex items-center justify-center"
                    >
                        {/* Modal */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-lg bg-background border border-border rounded-2xl shadow-elevated max-h-[90vh] overflow-hidden mx-4"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between p-6 border-b border-border">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-destructive/10 rounded-lg">
                                        <Flag className="w-5 h-5 text-destructive" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-semibold text-foreground">
                                            Report {contentType === 'scribe' ? 'Post' : 'Omzo'}
                                        </h2>
                                        <p className="text-sm text-muted-foreground">Help us keep the community safe</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleClose}
                                    className="p-2 hover:bg-secondary rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                                {success ? (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="text-center py-8"
                                    >
                                        <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                        <h3 className="text-lg font-semibold text-foreground mb-2">Report Submitted</h3>
                                        <p className="text-muted-foreground">Thank you for helping us maintain a safe community. We'll review this report shortly.</p>
                                    </motion.div>
                                ) : (
                                    <form onSubmit={handleSubmit} className="space-y-6">
                                        {/* Reason Selection */}
                                        <div>
                                            <label className="block text-sm font-medium text-foreground mb-3">
                                                Why are you reporting this {contentType === 'scribe' ? 'post' : 'omzo'}?
                                            </label>
                                            <div className="space-y-2">
                                                {REPORT_REASONS.map((reason) => (
                                                    <label
                                                        key={reason.value}
                                                        className={`flex items-start gap-3 p-4 border rounded-xl cursor-pointer transition-all ${selectedReason === reason.value
                                                            ? 'border-primary bg-primary/5'
                                                            : 'border-border hover:border-primary/50 hover:bg-secondary/50'
                                                            }`}
                                                    >
                                                        <input
                                                            type="radio"
                                                            name="reason"
                                                            value={reason.value}
                                                            checked={selectedReason === reason.value}
                                                            onChange={(e) => setSelectedReason(e.target.value)}
                                                            className="mt-1"
                                                        />
                                                        <div className="flex-1">
                                                            <div className="font-medium text-foreground">{reason.label}</div>
                                                            <div className="text-sm text-muted-foreground">{reason.description}</div>
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Copyright-specific fields */}
                                        {selectedReason === 'copyright' && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="space-y-4 p-4 bg-warning/5 border border-warning/20 rounded-xl"
                                            >
                                                <div className="flex items-start gap-2 text-warning">
                                                    <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                                                    <p className="text-sm">Please provide details about the copyright infringement</p>
                                                </div>

                                                {/* Copyright Type */}
                                                <div>
                                                    <label className="block text-sm font-medium text-foreground mb-2">
                                                        Copyright Type
                                                    </label>
                                                    <div className="space-y-2">
                                                        {COPYRIGHT_TYPES.map((type) => (
                                                            <label
                                                                key={type.value}
                                                                className="flex items-center gap-2 cursor-pointer"
                                                            >
                                                                <input
                                                                    type="radio"
                                                                    name="copyrightType"
                                                                    value={type.value}
                                                                    checked={copyrightType === type.value}
                                                                    onChange={(e) => setCopyrightType(e.target.value as 'audio' | 'content' | 'both')}
                                                                />
                                                                <span className="text-sm text-foreground">{type.label}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Copyright Description */}
                                                <div>
                                                    <label className="block text-sm font-medium text-foreground mb-2">
                                                        Copyright Details
                                                    </label>
                                                    <textarea
                                                        value={copyrightDescription}
                                                        onChange={(e) => setCopyrightDescription(e.target.value)}
                                                        placeholder="Describe the copyrighted material and your ownership..."
                                                        className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                                                        rows={3}
                                                    />
                                                </div>

                                                {/* Disable Audio (Omzo only) */}
                                                {contentType === 'omzo' && (
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={disableAudio}
                                                            onChange={(e) => setDisableAudio(e.target.checked)}
                                                            className="rounded"
                                                        />
                                                        <span className="text-sm text-foreground">Disable audio for this omzo</span>
                                                    </label>
                                                )}
                                            </motion.div>
                                        )}

                                        {/* Additional Description */}
                                        <div>
                                            <label className="block text-sm font-medium text-foreground mb-2">
                                                Additional Details (Optional)
                                            </label>
                                            <textarea
                                                value={description}
                                                onChange={(e) => setDescription(e.target.value)}
                                                placeholder="Provide any additional context..."
                                                className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                                                rows={3}
                                            />
                                        </div>

                                        {/* Error Message */}
                                        {error && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm"
                                            >
                                                {error}
                                            </motion.div>
                                        )}

                                        {/* Submit Button */}
                                        <div className="flex gap-3">
                                            <button
                                                type="button"
                                                onClick={handleClose}
                                                className="flex-1 px-6 py-3 bg-secondary text-foreground rounded-xl font-medium hover:bg-secondary/80 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={isSubmitting || !selectedReason}
                                                className="flex-1 px-6 py-3 bg-destructive text-destructive-foreground rounded-xl font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {isSubmitting ? 'Submitting...' : 'Submit Report'}
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
