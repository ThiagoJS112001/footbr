import { useState } from 'react';
import type { ReactNode } from 'react';
import styles from './DataTable.module.css';

export interface Column<T> {
  id: string;
  label: string;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  align?: 'left' | 'right' | 'center';
}
interface Props<T> {
  caption: string;
  rows: readonly T[];
  columns: readonly Column<T>[];
  getRowId: (row: T) => string;
  getRowClassName?: (row: T) => string;
  initialSort?: { id: string; direction: 'asc' | 'desc' };
  pageSize?: number;
}

export function DataTable<T>({ caption, rows, columns, getRowId, getRowClassName, initialSort, pageSize }: Props<T>) {
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(0);
  const column = columns.find((candidate) => candidate.id === sort?.id);
  const sorted = column?.sortValue && sort ? [...rows].sort((a, b) => {
    const left = column.sortValue!(a);
    const right = column.sortValue!(b);
    const result = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right), 'pt-BR');
    return sort.direction === 'asc' ? result : -result;
  }) : rows;
  const pages = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const currentPage = Math.min(page, pages - 1);
  const visible = pageSize ? sorted.slice(currentPage * pageSize, (currentPage + 1) * pageSize) : sorted;
  return <div className={styles.scroll} tabIndex={0} role="region" aria-label={caption}>
    <table className={styles.table}>
      <caption className="srOnly">{caption}</caption>
      <thead><tr>{columns.map((col) => <th key={col.id} scope="col" style={{ textAlign: col.align ?? 'left' }} aria-sort={col.sortValue ? sort?.id === col.id ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none' : undefined}>
        {col.sortValue ? <button type="button" className={styles.sortButton} onClick={() => { setSort({ id: col.id, direction: sort?.id === col.id && sort.direction === 'asc' ? 'desc' : 'asc' }); setPage(0); }}>
          {col.label}<span aria-hidden="true" className={sort?.id === col.id ? styles.activeArrow : styles.arrow}>{sort?.id === col.id ? sort.direction === 'asc' ? '↑' : '↓' : '↕'}</span>
        </button> : col.label}
      </th>)}</tr></thead>
      <tbody>{visible.map((row) => <tr key={getRowId(row)} className={getRowClassName?.(row)}>{columns.map((col) => <td key={col.id} style={{ textAlign: col.align ?? 'left' }}>{col.render(row)}</td>)}</tr>)}</tbody>
    </table>
    {rows.length === 0 && <p className={styles.empty}>Nenhum registro para exibir.</p>}
    {pageSize && pages > 1 && <div className={styles.pagination}><button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Página anterior</button><span>Página {currentPage + 1} de {pages} · {rows.length} registros</span><button disabled={currentPage === pages - 1} onClick={() => setPage(currentPage + 1)}>Próxima página</button></div>}
  </div>;
}
