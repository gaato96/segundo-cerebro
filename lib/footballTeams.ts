export interface FootballTeam {
    id: string
    name: string
    league: string
    country: string
    flag: string
    division: '1st' | '2nd'
    isCustom?: boolean
}

export interface LeagueCategory {
    name: string
    country: string
    flag: string
    division: '1st' | '2nd'
}

export const LEAGUES: LeagueCategory[] = [
    { name: 'Premier League', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', division: '1st' },
    { name: 'EFL Championship', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', division: '2nd' },
    { name: 'LaLiga EA Sports', country: 'España', flag: '🇪🇸', division: '1st' },
    { name: 'LaLiga Hypermotion', country: 'España', flag: '🇪🇸', division: '2nd' },
    { name: 'Serie A', country: 'Italia', flag: '🇮🇹', division: '1st' },
    { name: 'Serie B', country: 'Italia', flag: '🇮🇹', division: '2nd' },
    { name: 'Bundesliga', country: 'Alemania', flag: '🇩🇪', division: '1st' },
    { name: 'Ligue 1', country: 'Francia', flag: '🇫🇷', division: '1st' },
    { name: 'Liga Profesional', country: 'Argentina', flag: '🇦🇷', division: '1st' },
    { name: 'Brasileirão', country: 'Brasil', flag: '🇧🇷', division: '1st' },
    { name: 'Liga MX', country: 'México', flag: '🇲🇽', division: '1st' },
    { name: 'Eredivisie', country: 'Países Bajos', flag: '🇳🇱', division: '1st' },
    { name: 'Liga Portugal', country: 'Portugal', flag: '🇵🇹', division: '1st' }
]

export const PREDEFINED_TEAMS: FootballTeam[] = [
    // Premier League
    { id: 'eng-1', name: 'Manchester City', league: 'Premier League', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', division: '1st' },
    { id: 'eng-2', name: 'Arsenal', league: 'Premier League', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', division: '1st' },
    { id: 'eng-3', name: 'Liverpool', league: 'Premier League', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', division: '1st' },
    { id: 'eng-4', name: 'Aston Villa', league: 'Premier League', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', division: '1st' },
    { id: 'eng-5', name: 'Tottenham Hotspur', league: 'Premier League', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', division: '1st' },
    { id: 'eng-6', name: 'Chelsea', league: 'Premier League', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', division: '1st' },
    { id: 'eng-7', name: 'Manchester United', league: 'Premier League', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', division: '1st' },
    { id: 'eng-8', name: 'Newcastle United', league: 'Premier League', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', division: '1st' },
    { id: 'eng-9', name: 'West Ham United', league: 'Premier League', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', division: '1st' },
    { id: 'eng-10', name: 'Brighton & Hove Albion', league: 'Premier League', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', division: '1st' },
    { id: 'eng-11', name: 'Wolverhampton Wanderers', league: 'Premier League', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', division: '1st' },
    { id: 'eng-12', name: 'Bournemouth', league: 'Premier League', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', division: '1st' },
    { id: 'eng-13', name: 'Fulham', league: 'Premier League', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', division: '1st' },
    { id: 'eng-14', name: 'Crystal Palace', league: 'Premier League', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', division: '1st' },
    { id: 'eng-15', name: 'Everton', league: 'Premier League', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', division: '1st' },
    { id: 'eng-16', name: 'Brentford', league: 'Premier League', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', division: '1st' },
    { id: 'eng-17', name: 'Nottingham Forest', league: 'Premier League', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', division: '1st' },
    { id: 'eng-18', name: 'Leicester City', league: 'Premier League', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', division: '1st' },
    { id: 'eng-19', name: 'Ipswich Town', league: 'Premier League', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', division: '1st' },
    { id: 'eng-20', name: 'Southampton', league: 'Premier League', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', division: '1st' },

    // EFL Championship (Inglaterra 2ª)
    { id: 'eng2-1', name: 'Leeds United', league: 'EFL Championship', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', division: '2nd' },
    { id: 'eng2-2', name: 'Sunderland', league: 'EFL Championship', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', division: '2nd' },
    { id: 'eng2-3', name: 'Sheffield United', league: 'EFL Championship', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', division: '2nd' },
    { id: 'eng2-4', name: 'Burnley', league: 'EFL Championship', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', division: '2nd' },
    { id: 'eng2-5', name: 'West Bromwich Albion', league: 'EFL Championship', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', division: '2nd' },
    { id: 'eng2-6', name: 'Middlesbrough', league: 'EFL Championship', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', division: '2nd' },
    { id: 'eng2-7', name: 'Norwich City', league: 'EFL Championship', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', division: '2nd' },
    { id: 'eng2-8', name: 'Coventry City', league: 'EFL Championship', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', division: '2nd' },
    { id: 'eng2-9', name: 'Watford', league: 'EFL Championship', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', division: '2nd' },
    { id: 'eng2-10', name: 'Hull City', league: 'EFL Championship', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', division: '2nd' },
    { id: 'eng2-11', name: 'Blackburn Rovers', league: 'EFL Championship', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', division: '2nd' },
    { id: 'eng2-12', name: 'Stoke City', league: 'EFL Championship', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', division: '2nd' },
    { id: 'eng2-13', name: 'Millwall', league: 'EFL Championship', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', division: '2nd' },
    { id: 'eng2-14', name: 'Preston North End', league: 'EFL Championship', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', division: '2nd' },
    { id: 'eng2-15', name: 'Derby County', league: 'EFL Championship', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', division: '2nd' },
    { id: 'eng2-16', name: 'Portsmouth', league: 'EFL Championship', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', division: '2nd' },

    // LaLiga EA Sports (España 1ª)
    { id: 'esp-1', name: 'Real Madrid', league: 'LaLiga EA Sports', country: 'España', flag: '🇪🇸', division: '1st' },
    { id: 'esp-2', name: 'FC Barcelona', league: 'LaLiga EA Sports', country: 'España', flag: '🇪🇸', division: '1st' },
    { id: 'esp-3', name: 'Atlético de Madrid', league: 'LaLiga EA Sports', country: 'España', flag: '🇪🇸', division: '1st' },
    { id: 'esp-4', name: 'Athletic Club', league: 'LaLiga EA Sports', country: 'España', flag: '🇪🇸', division: '1st' },
    { id: 'esp-5', name: 'Girona FC', league: 'LaLiga EA Sports', country: 'España', flag: '🇪🇸', division: '1st' },
    { id: 'esp-6', name: 'Real Sociedad', league: 'LaLiga EA Sports', country: 'España', flag: '🇪🇸', division: '1st' },
    { id: 'esp-7', name: 'Real Betis', league: 'LaLiga EA Sports', country: 'España', flag: '🇪🇸', division: '1st' },
    { id: 'esp-8', name: 'Villarreal CF', league: 'LaLiga EA Sports', country: 'España', flag: '🇪🇸', division: '1st' },
    { id: 'esp-9', name: 'Valencia CF', league: 'LaLiga EA Sports', country: 'España', flag: '🇪🇸', division: '1st' },
    { id: 'esp-10', name: 'Sevilla FC', league: 'LaLiga EA Sports', country: 'España', flag: '🇪🇸', division: '1st' },
    { id: 'esp-11', name: 'CA Osasuna', league: 'LaLiga EA Sports', country: 'España', flag: '🇪🇸', division: '1st' },
    { id: 'esp-12', name: 'RC Celta de Vigo', league: 'LaLiga EA Sports', country: 'España', flag: '🇪🇸', division: '1st' },
    { id: 'esp-13', name: 'Getafe CF', league: 'LaLiga EA Sports', country: 'España', flag: '🇪🇸', division: '1st' },
    { id: 'esp-14', name: 'Rayo Vallecano', league: 'LaLiga EA Sports', country: 'España', flag: '🇪🇸', division: '1st' },
    { id: 'esp-15', name: 'RCD Mallorca', league: 'LaLiga EA Sports', country: 'España', flag: '🇪🇸', division: '1st' },
    { id: 'esp-16', name: 'UD Las Palmas', league: 'LaLiga EA Sports', country: 'España', flag: '🇪🇸', division: '1st' },
    { id: 'esp-17', name: 'Deportivo Alavés', league: 'LaLiga EA Sports', country: 'España', flag: '🇪🇸', division: '1st' },
    { id: 'esp-18', name: 'RCD Espanyol', league: 'LaLiga EA Sports', country: 'España', flag: '🇪🇸', division: '1st' },
    { id: 'esp-19', name: 'Real Valladolid', league: 'LaLiga EA Sports', country: 'España', flag: '🇪🇸', division: '1st' },
    { id: 'esp-20', name: 'CD Leganés', league: 'LaLiga EA Sports', country: 'España', flag: '🇪🇸', division: '1st' },

    // LaLiga Hypermotion (España 2ª)
    { id: 'esp2-1', name: 'Deportivo de La Coruña', league: 'LaLiga Hypermotion', country: 'España', flag: '🇪🇸', division: '2nd' },
    { id: 'esp2-2', name: 'Real Zaragoza', league: 'LaLiga Hypermotion', country: 'España', flag: '🇪🇸', division: '2nd' },
    { id: 'esp2-3', name: 'Sporting de Gijón', league: 'LaLiga Hypermotion', country: 'España', flag: '🇪🇸', division: '2nd' },
    { id: 'esp2-4', name: 'Real Oviedo', league: 'LaLiga Hypermotion', country: 'España', flag: '🇪🇸', division: '2nd' },
    { id: 'esp2-5', name: 'Granada CF', league: 'LaLiga Hypermotion', country: 'España', flag: '🇪🇸', division: '2nd' },
    { id: 'esp2-6', name: 'UD Almería', league: 'LaLiga Hypermotion', country: 'España', flag: '🇪🇸', division: '2nd' },
    { id: 'esp2-7', name: 'Cádiz CF', league: 'LaLiga Hypermotion', country: 'España', flag: '🇪🇸', division: '2nd' },
    { id: 'esp2-8', name: 'Málaga CF', league: 'LaLiga Hypermotion', country: 'España', flag: '🇪🇸', division: '2nd' },
    { id: 'esp2-9', name: 'Levante UD', league: 'LaLiga Hypermotion', country: 'España', flag: '🇪🇸', division: '2nd' },
    { id: 'esp2-10', name: 'Elche CF', league: 'LaLiga Hypermotion', country: 'España', flag: '🇪🇸', division: '2nd' },
    { id: 'esp2-11', name: 'Racing de Santander', league: 'LaLiga Hypermotion', country: 'España', flag: '🇪🇸', division: '2nd' },
    { id: 'esp2-12', name: 'SD Eibar', league: 'LaLiga Hypermotion', country: 'España', flag: '🇪🇸', division: '2nd' },
    { id: 'esp2-13', name: 'CD Tenerife', league: 'LaLiga Hypermotion', country: 'España', flag: '🇪🇸', division: '2nd' },
    { id: 'esp2-14', name: 'Burgos CF', league: 'LaLiga Hypermotion', country: 'España', flag: '🇪🇸', division: '2nd' },
    { id: 'esp2-15', name: 'Albacete Balompié', league: 'LaLiga Hypermotion', country: 'España', flag: '🇪🇸', division: '2nd' },

    // Serie A (Italia 1ª)
    { id: 'ita-1', name: 'Inter de Milán', league: 'Serie A', country: 'Italia', flag: '🇮🇹', division: '1st' },
    { id: 'ita-2', name: 'AC Milan', league: 'Serie A', country: 'Italia', flag: '🇮🇹', division: '1st' },
    { id: 'ita-3', name: 'Juventus', league: 'Serie A', country: 'Italia', flag: '🇮🇹', division: '1st' },
    { id: 'ita-4', name: 'Atalanta', league: 'Serie A', country: 'Italia', flag: '🇮🇹', division: '1st' },
    { id: 'ita-5', name: 'AS Roma', league: 'Serie A', country: 'Italia', flag: '🇮🇹', division: '1st' },
    { id: 'ita-6', name: 'SS Lazio', league: 'Serie A', country: 'Italia', flag: '🇮🇹', division: '1st' },
    { id: 'ita-7', name: 'Napoli', league: 'Serie A', country: 'Italia', flag: '🇮🇹', division: '1st' },
    { id: 'ita-8', name: 'Fiorentina', league: 'Serie A', country: 'Italia', flag: '🇮🇹', division: '1st' },
    { id: 'ita-9', name: 'Bologna', league: 'Serie A', country: 'Italia', flag: '🇮🇹', division: '1st' },
    { id: 'ita-10', name: 'Torino', league: 'Serie A', country: 'Italia', flag: '🇮🇹', division: '1st' },
    { id: 'ita-11', name: 'Genoa', league: 'Serie A', country: 'Italia', flag: '🇮🇹', division: '1st' },
    { id: 'ita-12', name: 'Udinese', league: 'Serie A', country: 'Italia', flag: '🇮🇹', division: '1st' },
    { id: 'ita-13', name: 'Monza', league: 'Serie A', country: 'Italia', flag: '🇮🇹', division: '1st' },
    { id: 'ita-14', name: 'Verona', league: 'Serie A', country: 'Italia', flag: '🇮🇹', division: '1st' },
    { id: 'ita-15', name: 'Cagliari', league: 'Serie A', country: 'Italia', flag: '🇮🇹', division: '1st' },
    { id: 'ita-16', name: 'Lecce', league: 'Serie A', country: 'Italia', flag: '🇮🇹', division: '1st' },
    { id: 'ita-17', name: 'Empoli', league: 'Serie A', country: 'Italia', flag: '🇮🇹', division: '1st' },
    { id: 'ita-18', name: 'Parma', league: 'Serie A', country: 'Italia', flag: '🇮🇹', division: '1st' },
    { id: 'ita-19', name: 'Como 1907', league: 'Serie A', country: 'Italia', flag: '🇮🇹', division: '1st' },
    { id: 'ita-20', name: 'Venezia', league: 'Serie A', country: 'Italia', flag: '🇮🇹', division: '1st' },

    // Serie B (Italia 2ª)
    { id: 'ita2-1', name: 'Sampdoria', league: 'Serie B', country: 'Italia', flag: '🇮🇹', division: '2nd' },
    { id: 'ita2-2', name: 'Sassuolo', league: 'Serie B', country: 'Italia', flag: '🇮🇹', division: '2nd' },
    { id: 'ita2-3', name: 'Salernitana', league: 'Serie B', country: 'Italia', flag: '🇮🇹', division: '2nd' },
    { id: 'ita2-4', name: 'Frosinone', league: 'Serie B', country: 'Italia', flag: '🇮🇹', division: '2nd' },
    { id: 'ita2-5', name: 'Palermo', league: 'Serie B', country: 'Italia', flag: '🇮🇹', division: '2nd' },
    { id: 'ita2-6', name: 'Brescia', league: 'Serie B', country: 'Italia', flag: '🇮🇹', division: '2nd' },
    { id: 'ita2-7', name: 'Bari', league: 'Serie B', country: 'Italia', flag: '🇮🇹', division: '2nd' },
    { id: 'ita2-8', name: 'Cremonese', league: 'Serie B', country: 'Italia', flag: '🇮🇹', division: '2nd' },
    { id: 'ita2-9', name: 'Spezia', league: 'Serie B', country: 'Italia', flag: '🇮🇹', division: '2nd' },
    { id: 'ita2-10', name: 'Pisa', league: 'Serie B', country: 'Italia', flag: '🇮🇹', division: '2nd' },
    { id: 'ita2-11', name: 'Cesena', league: 'Serie B', country: 'Italia', flag: '🇮🇹', division: '2nd' },
    { id: 'ita2-12', name: 'Modena', league: 'Serie B', country: 'Italia', flag: '🇮🇹', division: '2nd' },

    // Bundesliga (Alemania 1ª)
    { id: 'ger-1', name: 'Bayer Leverkusen', league: 'Bundesliga', country: 'Alemania', flag: '🇩🇪', division: '1st' },
    { id: 'ger-2', name: 'Bayern Múnich', league: 'Bundesliga', country: 'Alemania', flag: '🇩🇪', division: '1st' },
    { id: 'ger-3', name: 'Borussia Dortmund', league: 'Bundesliga', country: 'Alemania', flag: '🇩🇪', division: '1st' },
    { id: 'ger-4', name: 'RB Leipzig', league: 'Bundesliga', country: 'Alemania', flag: '🇩🇪', division: '1st' },
    { id: 'ger-5', name: 'Eintracht Frankfurt', league: 'Bundesliga', country: 'Alemania', flag: '🇩🇪', division: '1st' },
    { id: 'ger-6', name: 'VfB Stuttgart', league: 'Bundesliga', country: 'Alemania', flag: '🇩🇪', division: '1st' },
    { id: 'ger-7', name: 'VfL Wolfsburg', league: 'Bundesliga', country: 'Alemania', flag: '🇩🇪', division: '1st' },
    { id: 'ger-8', name: 'Borussia Mönchengladbach', league: 'Bundesliga', country: 'Alemania', flag: '🇩🇪', division: '1st' },
    { id: 'ger-9', name: 'Werder Bremen', league: 'Bundesliga', country: 'Alemania', flag: '🇩🇪', division: '1st' },
    { id: 'ger-10', name: 'SC Freiburg', league: 'Bundesliga', country: 'Alemania', flag: '🇩🇪', division: '1st' },
    { id: 'ger-11', name: 'TSG 1899 Hoffenheim', league: 'Bundesliga', country: 'Alemania', flag: '🇩🇪', division: '1st' },
    { id: 'ger-12', name: 'FC Augsburg', league: 'Bundesliga', country: 'Alemania', flag: '🇩🇪', division: '1st' },
    { id: 'ger-13', name: '1. FC Union Berlin', league: 'Bundesliga', country: 'Alemania', flag: '🇩🇪', division: '1st' },
    { id: 'ger-14', name: '1. FSV Mainz 05', league: 'Bundesliga', country: 'Alemania', flag: '🇩🇪', division: '1st' },
    { id: 'ger-15', name: 'FC St. Pauli', league: 'Bundesliga', country: 'Alemania', flag: '🇩🇪', division: '1st' },
    { id: 'ger-16', name: 'Holstein Kiel', league: 'Bundesliga', country: 'Alemania', flag: '🇩🇪', division: '1st' },

    // Ligue 1 (Francia 1ª)
    { id: 'fra-1', name: 'Paris Saint-Germain', league: 'Ligue 1', country: 'Francia', flag: '🇫🇷', division: '1st' },
    { id: 'fra-2', name: 'AS Monaco', league: 'Ligue 1', country: 'Francia', flag: '🇫🇷', division: '1st' },
    { id: 'fra-3', name: 'Olympique de Marsella', league: 'Ligue 1', country: 'Francia', flag: '🇫🇷', division: '1st' },
    { id: 'fra-4', name: 'Olympique de Lyon', league: 'Ligue 1', country: 'Francia', flag: '🇫🇷', division: '1st' },
    { id: 'fra-5', name: 'LOSC Lille', league: 'Ligue 1', country: 'Francia', flag: '🇫🇷', division: '1st' },
    { id: 'fra-6', name: 'RC Lens', league: 'Ligue 1', country: 'Francia', flag: '🇫🇷', division: '1st' },
    { id: 'fra-7', name: 'OGC Nice', league: 'Ligue 1', country: 'Francia', flag: '🇫🇷', division: '1st' },
    { id: 'fra-8', name: 'Stade Rennais', league: 'Ligue 1', country: 'Francia', flag: '🇫🇷', division: '1st' },
    { id: 'fra-9', name: 'Stade de Reims', league: 'Ligue 1', country: 'Francia', flag: '🇫🇷', division: '1st' },
    { id: 'fra-10', name: 'Toulouse FC', league: 'Ligue 1', country: 'Francia', flag: '🇫🇷', division: '1st' },
    { id: 'fra-11', name: 'AS Saint-Étienne', league: 'Ligue 1', country: 'Francia', flag: '🇫🇷', division: '1st' },
    { id: 'fra-12', name: 'FC Nantes', league: 'Ligue 1', country: 'Francia', flag: '🇫🇷', division: '1st' },

    // Liga Profesional (Argentina 1ª)
    { id: 'arg-1', name: 'Boca Juniors', league: 'Liga Profesional', country: 'Argentina', flag: '🇦🇷', division: '1st' },
    { id: 'arg-2', name: 'River Plate', league: 'Liga Profesional', country: 'Argentina', flag: '🇦🇷', division: '1st' },
    { id: 'arg-3', name: 'Racing Club', league: 'Liga Profesional', country: 'Argentina', flag: '🇦🇷', division: '1st' },
    { id: 'arg-4', name: 'Independiente', league: 'Liga Profesional', country: 'Argentina', flag: '🇦🇷', division: '1st' },
    { id: 'arg-5', name: 'San Lorenzo', league: 'Liga Profesional', country: 'Argentina', flag: '🇦🇷', division: '1st' },
    { id: 'arg-6', name: 'Vélez Sarsfield', league: 'Liga Profesional', country: 'Argentina', flag: '🇦🇷', division: '1st' },
    { id: 'arg-7', name: 'Estudiantes de La Plata', league: 'Liga Profesional', country: 'Argentina', flag: '🇦🇷', division: '1st' },
    { id: 'arg-8', name: 'Gimnasia y Esgrima La Plata', league: 'Liga Profesional', country: 'Argentina', flag: '🇦🇷', division: '1st' },
    { id: 'arg-9', name: 'Rosario Central', league: 'Liga Profesional', country: 'Argentina', flag: '🇦🇷', division: '1st' },
    { id: 'arg-10', name: "Newell's Old Boys", league: 'Liga Profesional', country: 'Argentina', flag: '🇦🇷', division: '1st' },
    { id: 'arg-11', name: 'Talleres de Córdoba', league: 'Liga Profesional', country: 'Argentina', flag: '🇦🇷', division: '1st' },
    { id: 'arg-12', name: 'Belgrano de Córdoba', league: 'Liga Profesional', country: 'Argentina', flag: '🇦🇷', division: '1st' },
    { id: 'arg-13', name: 'Argentinos Juniors', league: 'Liga Profesional', country: 'Argentina', flag: '🇦🇷', division: '1st' },
    { id: 'arg-14', name: 'Lanús', league: 'Liga Profesional', country: 'Argentina', flag: '🇦🇷', division: '1st' },
    { id: 'arg-15', name: 'Banfield', league: 'Liga Profesional', country: 'Argentina', flag: '🇦🇷', division: '1st' },
    { id: 'arg-16', name: 'Huracán', league: 'Liga Profesional', country: 'Argentina', flag: '🇦🇷', division: '1st' },
    { id: 'arg-17', name: 'Godoy Cruz', league: 'Liga Profesional', country: 'Argentina', flag: '🇦🇷', division: '1st' },
    { id: 'arg-18', name: 'Defensa y Justicia', league: 'Liga Profesional', country: 'Argentina', flag: '🇦🇷', division: '1st' },
    { id: 'arg-19', name: 'Tigre', league: 'Liga Profesional', country: 'Argentina', flag: '🇦🇷', division: '1st' },
    { id: 'arg-20', name: 'Platense', league: 'Liga Profesional', country: 'Argentina', flag: '🇦🇷', division: '1st' },

    // Brasileirão (Brasil 1ª)
    { id: 'bra-1', name: 'Flamengo', league: 'Brasileirão', country: 'Brasil', flag: '🇧🇷', division: '1st' },
    { id: 'bra-2', name: 'Palmeiras', league: 'Brasileirão', country: 'Brasil', flag: '🇧🇷', division: '1st' },
    { id: 'bra-3', name: 'São Paulo FC', league: 'Brasileirão', country: 'Brasil', flag: '🇧🇷', division: '1st' },
    { id: 'bra-4', name: 'Corinthians', league: 'Brasileirão', country: 'Brasil', flag: '🇧🇷', division: '1st' },
    { id: 'bra-5', name: 'Botafogo', league: 'Brasileirão', country: 'Brasil', flag: '🇧🇷', division: '1st' },
    { id: 'bra-6', name: 'Fluminense', league: 'Brasileirão', country: 'Brasil', flag: '🇧🇷', division: '1st' },
    { id: 'bra-7', name: 'Atlético Mineiro', league: 'Brasileirão', country: 'Brasil', flag: '🇧🇷', division: '1st' },
    { id: 'bra-8', name: 'Cruzeiro', league: 'Brasileirão', country: 'Brasil', flag: '🇧🇷', division: '1st' },
    { id: 'bra-9', name: 'Grêmio', league: 'Brasileirão', country: 'Brasil', flag: '🇧🇷', division: '1st' },
    { id: 'bra-10', name: 'Internacional', league: 'Brasileirão', country: 'Brasil', flag: '🇧🇷', division: '1st' },
    { id: 'bra-11', name: 'Vasco da Gama', league: 'Brasileirão', country: 'Brasil', flag: '🇧🇷', division: '1st' },
    { id: 'bra-12', name: 'Santos FC', league: 'Brasileirão', country: 'Brasil', flag: '🇧🇷', division: '1st' },

    // Liga MX (México 1ª)
    { id: 'mex-1', name: 'Club América', league: 'Liga MX', country: 'México', flag: '🇲🇽', division: '1st' },
    { id: 'mex-2', name: 'Chivas de Guadalajara', league: 'Liga MX', country: 'México', flag: '🇲🇽', division: '1st' },
    { id: 'mex-3', name: 'Cruz Azul', league: 'Liga MX', country: 'México', flag: '🇲🇽', division: '1st' },
    { id: 'mex-4', name: 'Pumas UNAM', league: 'Liga MX', country: 'México', flag: '🇲🇽', division: '1st' },
    { id: 'mex-5', name: 'Tigres UANL', league: 'Liga MX', country: 'México', flag: '🇲🇽', division: '1st' },
    { id: 'mex-6', name: 'CF Monterrey', league: 'Liga MX', country: 'México', flag: '🇲🇽', division: '1st' },
    { id: 'mex-7', name: 'Toluca FC', league: 'Liga MX', country: 'México', flag: '🇲🇽', division: '1st' },
    { id: 'mex-8', name: 'Club León', league: 'Liga MX', country: 'México', flag: '🇲🇽', division: '1st' },

    // Eredivisie (Países Bajos 1ª)
    { id: 'ned-1', name: 'AFC Ajax', league: 'Eredivisie', country: 'Países Bajos', flag: '🇳🇱', division: '1st' },
    { id: 'ned-2', name: 'PSV Eindhoven', league: 'Eredivisie', country: 'Países Bajos', flag: '🇳🇱', division: '1st' },
    { id: 'ned-3', name: 'Feyenoord', league: 'Eredivisie', country: 'Países Bajos', flag: '🇳🇱', division: '1st' },
    { id: 'ned-4', name: 'AZ Alkmaar', league: 'Eredivisie', country: 'Países Bajos', flag: '🇳🇱', division: '1st' },
    { id: 'ned-5', name: 'FC Twente', league: 'Eredivisie', country: 'Países Bajos', flag: '🇳🇱', division: '1st' },

    // Liga Portugal (Portugal 1ª)
    { id: 'por-1', name: 'SL Benfica', league: 'Liga Portugal', country: 'Portugal', flag: '🇵🇹', division: '1st' },
    { id: 'por-2', name: 'FC Porto', league: 'Liga Portugal', country: 'Portugal', flag: '🇵🇹', division: '1st' },
    { id: 'por-3', name: 'Sporting CP', league: 'Liga Portugal', country: 'Portugal', flag: '🇵🇹', division: '1st' },
    { id: 'por-4', name: 'SC Braga', league: 'Liga Portugal', country: 'Portugal', flag: '🇵🇹', division: '1st' },
]

export function getCustomTeams(): FootballTeam[] {
    if (typeof window === 'undefined') return []
    try {
        const stored = localStorage.getItem('custom_football_teams')
        return stored ? JSON.parse(stored) : []
    } catch {
        return []
    }
}

export function saveCustomTeam(team: Omit<FootballTeam, 'id' | 'isCustom'>): FootballTeam {
    const customTeams = getCustomTeams()
    const newTeam: FootballTeam = {
        ...team,
        id: `custom-${Date.now()}`,
        isCustom: true
    }
    const updated = [newTeam, ...customTeams]
    localStorage.setItem('custom_football_teams', JSON.stringify(updated))
    return newTeam
}

export function deleteCustomTeam(id: string): void {
    const customTeams = getCustomTeams().filter(t => t.id !== id)
    localStorage.setItem('custom_football_teams', JSON.stringify(customTeams))
}

export function getAllTeams(): FootballTeam[] {
    const custom = getCustomTeams()
    return [...custom, ...PREDEFINED_TEAMS]
}
