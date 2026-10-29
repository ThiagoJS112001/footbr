import type { League, LeagueStanding } from '../../engine/models';
import { ClubBadge } from './ClubBadge';
import { DataTable } from './DataTable';
import type { Column } from './DataTable';
import styles from '../App.module.css';

export function StandingsTable({ league, selectedTeamId, compact = false }: { league: League; selectedTeamId: string; compact?: boolean }) {
  const teams = new Map(league.teams.map((team) => [team.id, team]));
  const columns: Column<LeagueStanding>[] = [
    { id: 'position', label: '#', render: (row) => <span className={row.qualified ? styles.qualifiedPosition : row.relegated ? styles.relegatedPosition : ''}>{row.position}</span> },
    { id: 'club', label: 'Clube', render: (row) => <span className={styles.tableClub}><ClubBadge name={teams.get(row.teamId)!.name} /> <span>{teams.get(row.teamId)!.name}{row.teamId === selectedTeamId && <small className={styles.youTag}>VOCÊ</small>}</span></span> },
    { id: 'points', label: 'P', align: 'center', render: (row) => <strong>{row.points}</strong> },
    { id: 'played', label: 'J', align: 'center', render: (row) => row.played },
    ...(!compact ? [
      { id: 'wins', label: 'V', align: 'center' as const, render: (row: LeagueStanding) => row.wins },
      { id: 'draws', label: 'E', align: 'center' as const, render: (row: LeagueStanding) => row.draws },
      { id: 'losses', label: 'D', align: 'center' as const, render: (row: LeagueStanding) => row.losses },
      { id: 'gf', label: 'GP', align: 'center' as const, render: (row: LeagueStanding) => row.goalsFor },
      { id: 'ga', label: 'GC', align: 'center' as const, render: (row: LeagueStanding) => row.goalsAgainst },
    ] : []),
    { id: 'gd', label: 'SG', align: 'center', render: (row) => row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference },
  ];
  const rows = compact ? league.standings.filter((row) => row.position <= 5 || row.teamId === selectedTeamId) : league.standings;
  return <DataTable caption={compact ? 'Resumo da classificação' : 'Classificação completa'} rows={rows} columns={columns} getRowId={(row) => row.teamId} getRowClassName={(row) => `${row.qualified ? styles.qualifiedRow : row.relegated ? styles.relegatedRow : ''} ${row.teamId === selectedTeamId ? styles.selectedRow : ''}`} />;
}
