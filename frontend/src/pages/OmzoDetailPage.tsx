import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api, Omzo } from '@/services/api';
import { OmzoPlayer } from '@/components/OmzoPlayer';

export default function OmzoDetailPage() {
    const { omzoId } = useParams();
    const navigate = useNavigate();
    const [omzo, setOmzo] = useState<Omzo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!omzoId) return;

        const fetchOmzo = async () => {
            setLoading(true);
            try {
                const data = await api.getOmzo(omzoId);
                if (data) {
                    setOmzo(data);
                } else {
                    setError('Omzo not found');
                }
            } catch (err) {
                console.error(err);
                setError('Failed to load Omzo');
            } finally {
                setLoading(false);
            }
        };

        fetchOmzo();
    }, [omzoId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-black">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (error || !omzo) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
                <p className="text-destructive mb-4">{error || 'Omzo not found'}</p>
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Go Back
                </button>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black flex flex-col z-50">
            {/* Back Button Overlay */}
            <div className="absolute top-4 left-4 z-20 safe-top">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 bg-black/20 backdrop-blur-md rounded-full text-white hover:bg-black/40 transition-colors"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
            </div>

            <div className="w-full h-full">
                {/* Render a single OmzoPlayer as active */}
                <OmzoPlayer
                    omzo={omzo}
                    isActive={true}
                    onUserClick={() => navigate(`/profile/${omzo.user.username}`)}
                    onNavigate={() => { }} // No navigation for single view
                />
            </div>
        </div>
    );
}
