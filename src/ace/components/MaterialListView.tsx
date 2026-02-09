// =============================================================================
// Material List View - Displays the categorized material estimation output
// Shows quantities, waste factors, and audit trails for each item
// =============================================================================

import { useState } from 'react';
import type { MaterialList, MaterialItem, MaterialCategory } from '../types';

interface MaterialListViewProps {
  materialList: MaterialList;
}

export function MaterialListView({ materialList }: MaterialListViewProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(materialList.categories.map(c => c.name))
  );
  const [showAudit, setShowAudit] = useState<string | null>(null);
  const [showWithWaste, setShowWithWaste] = useState(true);

  const toggleCategory = (name: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const totalItems = materialList.categories.reduce(
    (sum, c) => sum + c.subcategories.reduce((s, sc) => s + sc.items.length, 0), 0
  );

  return (
    <div className="bg-white dark:bg-dark-base-medium rounded-xl border border-border-color dark:border-dark-border-color">
      <div className="p-4 border-b border-border-color dark:border-dark-border-color">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-text-primary dark:text-dark-text-primary">
              Material Estimation List
            </h3>
            <p className="text-sm text-text-secondary dark:text-dark-text-secondary">
              {totalItems} items across {materialList.categories.length} categories
              {' '}&middot; {materialList.waste_factor * 100}% waste factor applied
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-text-secondary dark:text-dark-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={showWithWaste}
                onChange={e => setShowWithWaste(e.target.checked)}
                className="rounded border-gray-300"
              />
              Show with waste
            </label>
            <button
              onClick={() => exportToCSV(materialList, showWithWaste)}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
            >
              Export CSV
            </button>
          </div>
        </div>
      </div>

      <div className="divide-y divide-border-color dark:divide-dark-border-color">
        {materialList.categories.map(category => (
          <CategorySection
            key={category.name}
            category={category}
            expanded={expandedCategories.has(category.name)}
            onToggle={() => toggleCategory(category.name)}
            showAudit={showAudit}
            onToggleAudit={setShowAudit}
            showWithWaste={showWithWaste}
          />
        ))}
      </div>
    </div>
  );
}

function CategorySection({
  category,
  expanded,
  onToggle,
  showAudit,
  onToggleAudit,
  showWithWaste,
}: {
  category: MaterialCategory;
  expanded: boolean;
  onToggle: () => void;
  showAudit: string | null;
  onToggleAudit: (id: string | null) => void;
  showWithWaste: boolean;
}) {
  const totalItemCount = category.subcategories.reduce((s, sc) => s + sc.items.length, 0);

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-dark-base-light transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={`transform transition-transform ${expanded ? 'rotate-90' : ''}`}>
            &#9654;
          </span>
          <span className="font-semibold text-text-primary dark:text-dark-text-primary">
            {category.name}
          </span>
          <span className="text-sm text-text-tertiary dark:text-dark-text-tertiary">
            ({totalItemCount} items)
          </span>
        </div>
      </button>

      {expanded && (
        <div className="pb-4 px-4">
          {category.subcategories.map(sub => (
            <div key={sub.name} className="mb-4">
              <h5 className="text-sm font-medium text-text-secondary dark:text-dark-text-secondary mb-2 pl-7">
                {sub.name}
              </h5>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-text-tertiary dark:text-dark-text-tertiary border-b border-border-color dark:border-dark-border-color">
                      <th className="pb-2 pl-7 pr-4">Item</th>
                      <th className="pb-2 pr-4 text-right">Quantity</th>
                      {showWithWaste && <th className="pb-2 pr-4 text-right">With Waste</th>}
                      <th className="pb-2 pr-4 text-right">Unit</th>
                      <th className="pb-2 pr-4 text-right">Waste %</th>
                      <th className="pb-2 text-center">Audit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sub.items.map(item => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        showAudit={showAudit === item.id}
                        onToggleAudit={() => onToggleAudit(showAudit === item.id ? null : item.id)}
                        showWithWaste={showWithWaste}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ItemRow({
  item,
  showAudit,
  onToggleAudit,
  showWithWaste,
}: {
  item: MaterialItem;
  showAudit: boolean;
  onToggleAudit: () => void;
  showWithWaste: boolean;
}) {
  return (
    <>
      <tr className="border-b border-border-color/30 dark:border-dark-border-color/30 hover:bg-gray-50 dark:hover:bg-dark-base-light">
        <td className="py-2 pl-7 pr-4">
          <div>
            <p className="font-medium text-text-primary dark:text-dark-text-primary text-sm">
              {item.name}
            </p>
            <p className="text-xs text-text-tertiary dark:text-dark-text-tertiary">
              {item.description}
            </p>
          </div>
        </td>
        <td className="py-2 pr-4 text-right font-mono font-semibold text-text-primary dark:text-dark-text-primary">
          {item.quantity.toLocaleString()}
        </td>
        {showWithWaste && (
          <td className="py-2 pr-4 text-right font-mono text-blue-600 dark:text-blue-400 font-semibold">
            {item.quantity_with_waste.toLocaleString()}
          </td>
        )}
        <td className="py-2 pr-4 text-right text-text-secondary dark:text-dark-text-secondary">
          {item.unit.replace(/_/g, ' ')}
        </td>
        <td className="py-2 pr-4 text-right text-text-tertiary dark:text-dark-text-tertiary">
          {item.waste_percentage > 0 ? `${item.waste_percentage}%` : '-'}
        </td>
        <td className="py-2 text-center">
          <button
            onClick={onToggleAudit}
            className="text-blue-500 hover:text-blue-600 text-xs underline"
          >
            {showAudit ? 'Hide' : 'Show'}
          </button>
        </td>
      </tr>
      {showAudit && (
        <tr>
          <td colSpan={showWithWaste ? 6 : 5} className="p-0">
            <div className="bg-gray-50 dark:bg-dark-base-light px-7 py-3 border-b border-border-color dark:border-dark-border-color">
              <p className="text-xs font-medium text-text-secondary dark:text-dark-text-secondary mb-1">
                Formula: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">{item.calculation_audit.formula}</code>
              </p>
              <p className="text-xs text-text-tertiary dark:text-dark-text-tertiary mb-1">
                Inputs: {JSON.stringify(item.calculation_audit.inputs)}
              </p>
              <div className="text-xs text-text-secondary dark:text-dark-text-secondary space-y-0.5">
                {item.calculation_audit.steps.map((step, i) => (
                  <p key={i} className="font-mono">{i + 1}. {step}</p>
                ))}
              </div>
              <p className="text-xs font-medium text-text-primary dark:text-dark-text-primary mt-1">
                Result: {item.calculation_audit.result.toLocaleString()}
              </p>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/**
 * Export material list to CSV for contractor use.
 */
function exportToCSV(list: MaterialList, _withWaste: boolean) {
  const headers = ['Category', 'Subcategory', 'Item', 'Description', 'Quantity', 'With Waste', 'Unit', 'Waste %'];
  const rows: string[][] = [];

  for (const cat of list.categories) {
    for (const sub of cat.subcategories) {
      for (const item of sub.items) {
        rows.push([
          cat.name,
          sub.name,
          item.name,
          item.description,
          String(item.quantity),
          String(item.quantity_with_waste),
          item.unit,
          String(item.waste_percentage),
        ]);
      }
    }
  }

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `material-list-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
