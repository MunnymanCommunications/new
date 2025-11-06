import React from 'react';
import { Icon } from '../Icon.tsx';

interface StatCardProps {
    icon: React.ComponentProps<typeof Icon>['name'];
    label: string;
    value: string | number;
}

export const StatCard: React.FC<StatCardProps> = ({ icon, label, value }) => {
    return (
        <div className="glassmorphic p-6 rounded-2xl flex items-center gap-6">
            <div className="p-4 bg-gradient-to-br from-brand-secondary-glow/20 to-brand-tertiary-glow/20 rounded-full">
                <Icon name={icon} className="w-8 h-8 text-brand-secondary-glow"/>
            </div>
            <div>
                <p className="text-sm font-medium text-text-secondary dark:text-dark-text-secondary">{label}</p>
                <p className="text-3xl font-bold text-text-primary dark:text-dark-text-primary">{value}</p>
            </div>
        </div>
    );
};
