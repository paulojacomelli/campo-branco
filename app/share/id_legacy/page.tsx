
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import SharedListView from '@/app/components/SharedListView';

export async function generateStaticParams() {
    return [];
}

export default function SharedListDynamicPage({ params }: { params: { id: string } }) {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#f8fafc]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
            <SharedListView id={params.id} />
        </Suspense>
    );
}
