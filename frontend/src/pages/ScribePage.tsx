import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api, Scribe } from '@/services/api';
import { ScribeCard } from '@/components/ScribeCard';

export default function ScribePage() {
    const { scribeId } = useParams();
    const navigate = useNavigate();
    const [scribe, setScribe] = useState<Scribe | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!scribeId) return;

        const fetchScribe = async () => {
            setLoading(true);
            try {
                const data = await api.getScribe(scribeId);
                if (data) {
                    setScribe(data);
                } else {
                    setError('Scribe not found');
                }
            } catch (err: any) {
                console.error(err);
                setError(err.message || 'Failed to load Scribe');
            } finally {
                setLoading(false);
            }
        };

        fetchScribe();
    }, [scribeId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (error || !scribe) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
                <p className="text-destructive mb-4">{error || 'Scribe not found'}</p>
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-lg"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Go Back
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border/50 px-4 py-3 flex items-center gap-4">
                <button
                    onClick={() => navigate('/')}
                    className="p-2 hover:bg-secondary rounded-full transition-colors"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-lg font-bold">Scribe</h1>
            </div>

            {/* Content */}
            <div className="flex-1 max-w-2xl mx-auto w-full p-4">
                <ScribeCard scribe={scribe} onUserClick={() => navigate('/profile/' + scribe.user.username)} />
            </div>
        </div>
    );
}
