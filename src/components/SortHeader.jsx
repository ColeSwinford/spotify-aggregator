import React, { memo } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

const SortHeader = memo(({ label, sortKey, currentSort, onSort, className = "" }) => {
  const isActive = currentSort.key === sortKey;
  return (
    <th 
      className={`p-4 cursor-pointer group transition-colors hover:text-white ${isActive ? 'text-[#1ed760]' : ''} ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center gap-2">
        {label}
        {isActive && (
          currentSort.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
        )}
        {!isActive && <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-50" />}
      </div>
    </th>
  );
});

export default SortHeader;