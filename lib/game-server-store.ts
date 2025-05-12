// Server-side game state storage

export type Player = "X" | "O" | null
export type BoardState = Player[]
export type UltimateBoardState = (Player | "draw")[]

export type GameRoom = {
  id: string
  players: string[]
  spectators: string[]
  currentPlayer: "X" | "O"
  boards: BoardState[]
  mainBoard: UltimateBoardState
  nextBoardIndex: number
  gameOver: boolean
  winner: "X" | "O" | "draw" | null
  lastMove: { boardIndex: number; cellIndex: number } | null
  lastUpdateTime: number
}

// In-memory storage for game rooms
// In a production app, this would be a database
export const gameRooms: Record<string, GameRoom> = {}
