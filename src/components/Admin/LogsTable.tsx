import React, { useState, useMemo } from 'react';
import type { AppLog } from '../../types.ts';

interface LogsTableProps {
    logs: AppLog[];
}

export const LogsTable: React.FC<LogsTableProps> = ({ logs }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState('all');

    const filteredLogs = useMemo(() => {
        let result = logs;

        // Date Filtering
        if (dateFilter !== 'all') {
            const now = new Date();
            const filterDate = new Date();
            if (dateFilter === 'today') {
                filterDate.setHours(0, 0, 0, 0);
            } else if (dateFilter === '7days') {
                filterDate.setDate(now.getDate() - 7);
            } else if (dateFilter === '30days') {
                filterDate.setDate(now.getDate() - 30);
            }
            result = result.filter(log => new Date(log.created_at) >= filterDate);
        }

        // Search Term Filtering
        if (searchTerm) {
            const lowercasedFilter = searchTerm.toLowerCase();
            result = result.filter(log =>
                log.profiles?.email?.toLowerCase().includes(lowercasedFilter) ||
                log.assistants?.name?.toLowerCase().includes(lowercasedFilter) ||
                log.event_type.toLowerCase().includes(lowercasedFilter)
            );
        }
        
        return result;
    }, [logs, searchTerm, dateFilter]);

    const getEventStyling = (eventType: AppLog['event_type']) => {
        switch (eventType) {
            case 'SESSION_START': return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
            case 'SESSION_END': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';
            case 'API_ERROR': return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300';
            default: return 'bg-base-medium text-text-primary dark:bg-dark-base-medium dark:text-dark-text-primary';
        }
    };
    
    const formatDuration = (ms?: number) => {
        if (ms === undefined) return 'N/A';
        const seconds = ms / 1000;
        if (seconds < 60) return `${seconds.toFixed(1)}s`;
        const minutes = seconds / 60;
        return `${minutes.toFixed(1)}m`;
    };

    return (
        <div>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <input
                    type="text"
                    placeholder="Search by user email, assistant..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="flex-grow p-2 border border-border-color rounded-md bg-white/70 focus:ring-2 focus:ring-brand-secondary-glow focus:border-transparent transition dark:bg-dark-base-light dark:border-dark-border-color dark:text-dark-text-primary"
                    aria-label="Search logs"
                />
                <select
                    value={dateFilter}
                    onChange={e => setDateFilter(e.target.value)}
                    className="p-2 border border-border-color rounded-md bg-white/70 focus:ring-2 focus:ring-brand-secondary-glow focus:border-transparent transition dark:bg-dark-base-light dark:border-dark-border-color dark:text-dark-text-primary"
                    aria-label="Filter logs by date"
                >
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="7days">Last 7 Days</option>
                    <option value="30days">Last 30 Days</option>
                </select>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="text-xs text-text-secondary dark:text-dark-text-secondary uppercase">
                        <tr>
                            <th scope="col" className="p-2">User</th>
                            <th scope="col" className="p-2">Assistant</th>
                            <th scope="col" className="p-2">Event</th>
                            <th scope="col" className="p-2">Duration</th>
                            <th scope="col" className="p-2">Details</th>
                            <th scope="col" className="p-2">Timestamp</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredLogs.map(log => (
                            <tr key={log.id} className="border-t border-border-color/50 dark:border-dark-border-color/50 hover:bg-base-light/50 dark:hover:bg-dark-base-medium/50">
                                <td className="p-2 truncate" title={log.profiles?.email}>{log.profiles?.email || 'Unknown User'}</td>
                                <td className="p-2 truncate" title={log.assistants?.name}>{log.assistants?.name || 'N/A'}</td>
                                <td className="p-2">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEventStyling(log.event_type)}`}>
                                        {log.event_type.replace(/_/g, ' ')}
                                    </span>
                                </td>
                                <td className="p-2">{formatDuration(log.metadata?.duration_ms)}</td>
                                <td className="p-2 max-w-xs truncate" title={log.metadata?.error_message}>{log.metadata?.error_message || 'N/A'}</td>
                                <td className="p-2 text-text-tertiary dark:text-dark-text-tertiary whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {filteredLogs.length === 0 && (
                    <p className="text-center text-text-secondary dark:text-dark-text-secondary p-8">No logs match the current filters.</p>
                )}
            </div>
        </div>
    );
};
