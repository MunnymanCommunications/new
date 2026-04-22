import React, { useEffect, useState } from 'react';
import {
  Database,
  Table2,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Columns,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  listProjectTables,
  getTableColumns,
  type ProjectTable,
  type TableColumn,
} from '@/lib/database-manager';
import { useProjectStore } from '@/stores/project';

export function DatabaseExplorer() {
  const { currentProjectId } = useProjectStore();
  const [tables, setTables] = useState<ProjectTable[]>([]);
  const [schema, setSchema] = useState<string>('');
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [columns, setColumns] = useState<Record<string, TableColumn[]>>({});
  const [loading, setLoading] = useState(false);
  const [loadingColumns, setLoadingColumns] = useState<string | null>(null);

  const loadTables = async () => {
    if (!currentProjectId) return;
    setLoading(true);
    const result = await listProjectTables(currentProjectId);
    setTables(result.tables);
    if (result.schema) setSchema(result.schema);
    setLoading(false);
  };

  useEffect(() => {
    loadTables();
  }, [currentProjectId]);

  const toggleTable = async (tableName: string) => {
    if (expandedTable === tableName) {
      setExpandedTable(null);
      return;
    }
    setExpandedTable(tableName);

    if (!columns[tableName] && currentProjectId) {
      setLoadingColumns(tableName);
      const cols = await getTableColumns(currentProjectId, tableName);
      setColumns((prev) => ({ ...prev, [tableName]: cols }));
      setLoadingColumns(null);
    }
  };

  if (!currentProjectId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Select a project to view its database
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-green-500" />
          <span className="text-sm font-medium">Database</span>
          {schema && (
            <Badge variant="secondary" className="text-xs">
              {schema}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={loadTables}
          disabled={loading}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {loading && tables.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Loading tables...
            </div>
          ) : tables.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No tables yet</p>
              <p className="text-xs mt-1">
                Ask the AI to create tables for your project
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {tables.map((table) => (
                <div key={table.table_name}>
                  <button
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent/50 transition-colors text-left text-sm"
                    onClick={() => toggleTable(table.table_name)}
                  >
                    {expandedTable === table.table_name ? (
                      <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <Table2 className="w-3.5 h-3.5 shrink-0 text-blue-500" />
                    <span className="truncate flex-1">{table.table_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {table.column_count} cols
                    </span>
                  </button>

                  {expandedTable === table.table_name && (
                    <div className="ml-6 pl-2 border-l border-border">
                      {loadingColumns === table.table_name ? (
                        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Loading columns...
                        </div>
                      ) : (
                        columns[table.table_name]?.map((col) => (
                          <div
                            key={col.column_name}
                            className="flex items-center gap-2 px-2 py-1 text-xs"
                          >
                            <Columns className="w-3 h-3 shrink-0 text-muted-foreground" />
                            <span className="truncate">{col.column_name}</span>
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1 py-0 shrink-0"
                            >
                              {col.data_type}
                            </Badge>
                            {col.is_nullable === 'NO' && (
                              <span className="text-[10px] text-orange-500">NOT NULL</span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
