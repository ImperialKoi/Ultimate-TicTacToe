"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { AlertCircle, RefreshCw, User } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import MultiplayerModal from "@/components/multiplayer-modal"
import { useMultiplayer } from "@/lib/multiplayer-client"

type Player = "X" | "O" | null
type BoardState = Player[]
type UltimateBoardState = (Player | "draw")[]

// Winning combinations
const WINNING_COMBINATIONS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8], // rows
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8], // columns
  [0, 4, 8],
  [2, 4, 6], // diagonals
]

export default function UltimateTicTacToe() {
  // State for all 9 boards (each with 9 cells)
  const [boards, setBoards] = useState<BoardState[]>(
    Array(9)
      .fill(null)
      .map(() => Array(9).fill(null)),
  )

  // State for the main board (tracking wins of small boards)
  const [mainBoard, setMainBoard] = useState<UltimateBoardState>(Array(9).fill(null))

  // Current player
  const [currentPlayer, setCurrentPlayer] = useState<Player>("X")

  // Next board to play in (-1 means any board can be played)
  const [nextBoardIndex, setNextBoardIndex] = useState<number>(-1)

  // Game over state
  const [gameOver, setGameOver] = useState<boolean>(false)

  // Winner of the game
  const [winner, setWinner] = useState<Player | "draw">(null)

  // AI settings
  const [playAgainstAI, setPlayAgainstAI] = useState<boolean>(true)
  const [aiPlayer, setAiPlayer] = useState<Player>("O")
  const [aiThinking, setAiThinking] = useState<boolean>(false)
  const [aiDepth, setAiDepth] = useState<number>(4)

  // Game mode
  const [gameMode, setGameMode] = useState<"local" | "ai" | "multiplayer">("ai")

  // Last move for highlighting
  const [lastMove, setLastMove] = useState<{ boardIndex: number; cellIndex: number } | null>(null)

  // Multiplayer client
  const {
    createRoom,
    joinRoom,
    leaveRoom,
    makeMove: makeMultiplayerMove,
    resetGame: resetMultiplayerGame,
    room,
    playerSymbol,
    isHost,
    error: multiplayerError,
    boards: multiplayerBoards,
    mainBoard: multiplayerMainBoard,
    currentPlayer: multiplayerCurrentPlayer,
    nextBoardIndex: multiplayerNextBoardIndex,
    gameOver: multiplayerGameOver,
    winner: multiplayerWinner,
    lastMove: multiplayerLastMove,
    playerCount,
    spectatorCount,
  } = useMultiplayer()

  const { toast } = useToast()

  // Sync multiplayer state to local state
  useEffect(() => {
    if (gameMode === "multiplayer" && room) {
      setBoards(multiplayerBoards)
      setMainBoard(multiplayerMainBoard)
      setCurrentPlayer(multiplayerCurrentPlayer)
      setNextBoardIndex(multiplayerNextBoardIndex)
      setGameOver(multiplayerGameOver)
      setWinner(multiplayerWinner)
      setLastMove(multiplayerLastMove)
    }
  }, [
    gameMode,
    room,
    multiplayerBoards,
    multiplayerMainBoard,
    multiplayerCurrentPlayer,
    multiplayerNextBoardIndex,
    multiplayerGameOver,
    multiplayerWinner,
    multiplayerLastMove,
  ])

  // Create a new multiplayer room
  const handleCreateRoom = useCallback(async () => {
    const roomId = await createRoom()

    if (roomId) {
      toast({
        title: "Room created",
        description: `Room ID: ${roomId}`,
      })
    }
  }, [createRoom, toast])

  // Join an existing multiplayer room
  const handleJoinRoom = useCallback(
    async (roomId: string) => {
      const result = await joinRoom(roomId)

      if (!result.success) {
        toast({
          title: "Error",
          description: result.error || "Failed to join room",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Room joined",
          description: `You joined room ${roomId}`,
        })
      }
    },
    [joinRoom, toast],
  )

  // Check if a board has a winner
  const checkBoardWinner = useCallback((board: BoardState): Player | "draw" => {
    for (const [a, b, c] of WINNING_COMBINATIONS) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a]
      }
    }

    // Check for draw
    if (board.every((cell) => cell !== null)) {
      return "draw"
    }

    return null
  }, [])

  // Get valid moves for a given board state
  const getValidMoves = useCallback(
    (boardIndex: number): number[] => {
      if (mainBoard[boardIndex] !== null) return []

      return boards[boardIndex].map((cell, index) => (cell === null ? index : -1)).filter((index) => index !== -1)
    },
    [boards, mainBoard],
  )

  // Get all valid moves for the current game state
  const getAllValidMoves = useCallback((): { boardIndex: number; cellIndex: number }[] => {
    const moves: { boardIndex: number; cellIndex: number }[] = []

    if (nextBoardIndex !== -1) {
      // If next board is specified and not won
      if (mainBoard[nextBoardIndex] === null) {
        getValidMoves(nextBoardIndex).forEach((cellIndex) => {
          moves.push({ boardIndex: nextBoardIndex, cellIndex })
        })
      } else {
        // If the specified board is already won, can play in any board
        for (let boardIndex = 0; boardIndex < 9; boardIndex++) {
          if (mainBoard[boardIndex] === null) {
            getValidMoves(boardIndex).forEach((cellIndex) => {
              moves.push({ boardIndex, cellIndex })
            })
          }
        }
      }
    } else {
      // Can play in any board
      for (let boardIndex = 0; boardIndex < 9; boardIndex++) {
        if (mainBoard[boardIndex] === null) {
          getValidMoves(boardIndex).forEach((cellIndex) => {
            moves.push({ boardIndex, cellIndex })
          })
        }
      }
    }

    return moves
  }, [getValidMoves, mainBoard, nextBoardIndex])

  // Evaluate the board state for the AI
  const evaluateBoard = useCallback(
    (player: Player): number => {
      const opponent = player === "X" ? "O" : "X"

      // Check if game is won
      const gameWinner = checkBoardWinner(mainBoard as BoardState)
      if (gameWinner === player) return 1000
      if (gameWinner === opponent) return -1000
      if (gameWinner === "draw") return 0

      let score = 0

      // Evaluate main board positions
      for (const [a, b, c] of WINNING_COMBINATIONS) {
        const line = [mainBoard[a], mainBoard[b], mainBoard[c]]
        const playerCount = line.filter((cell) => cell === player).length
        const opponentCount = line.filter((cell) => cell === opponent).length
        const emptyCount = line.filter((cell) => cell === null).length

        // Scoring based on potential winning lines
        if (playerCount > 0 && opponentCount === 0) {
          score += playerCount * 10
        }
        if (opponentCount > 0 && playerCount === 0) {
          score -= opponentCount * 10
        }
      }

      // Evaluate individual boards
      for (let boardIndex = 0; boardIndex < 9; boardIndex++) {
        if (mainBoard[boardIndex] === null) {
          for (const [a, b, c] of WINNING_COMBINATIONS) {
            const line = [boards[boardIndex][a], boards[boardIndex][b], boards[boardIndex][c]]
            const playerCount = line.filter((cell) => cell === player).length
            const opponentCount = line.filter((cell) => cell === opponent).length
            const emptyCount = line.filter((cell) => cell === null).length

            // Scoring based on potential winning lines in small boards
            if (playerCount > 0 && opponentCount === 0) {
              score += playerCount
            }
            if (opponentCount > 0 && playerCount === 0) {
              score -= opponentCount
            }
          }
        }
      }

      return score
    },
    [boards, mainBoard, checkBoardWinner],
  )

  // Minimax algorithm with alpha-beta pruning
  const minimax = useCallback(
    (
      depth: number,
      alpha: number,
      beta: number,
      isMaximizing: boolean,
      player: Player,
      currentBoards: BoardState[],
      currentMainBoard: UltimateBoardState,
      currentNextBoardIndex: number,
    ): { score: number; move?: { boardIndex: number; cellIndex: number } } => {
      // Create a temporary game state for simulation
      const tempBoards = JSON.parse(JSON.stringify(currentBoards))
      const tempMainBoard = [...currentMainBoard]

      // Base case: check if game is over or depth limit reached
      const gameWinner = checkBoardWinner(tempMainBoard as BoardState)
      if (gameWinner === player) return { score: 100 + depth }
      if (gameWinner === (player === "X" ? "O" : "X")) return { score: -100 - depth }
      if (gameWinner === "draw") return { score: 0 }
      if (depth === 0) return { score: evaluateBoard(player) }

      // Get all valid moves for the current state
      const validMoves: { boardIndex: number; cellIndex: number }[] = []

      if (currentNextBoardIndex !== -1) {
        // If next board is specified and not won
        if (tempMainBoard[currentNextBoardIndex] === null) {
          for (let cellIndex = 0; cellIndex < 9; cellIndex++) {
            if (tempBoards[currentNextBoardIndex][cellIndex] === null) {
              validMoves.push({ boardIndex: currentNextBoardIndex, cellIndex })
            }
          }
        } else {
          // If the specified board is already won, can play in any board
          for (let boardIndex = 0; boardIndex < 9; boardIndex++) {
            if (tempMainBoard[boardIndex] === null) {
              for (let cellIndex = 0; cellIndex < 9; cellIndex++) {
                if (tempBoards[boardIndex][cellIndex] === null) {
                  validMoves.push({ boardIndex, cellIndex })
                }
              }
            }
          }
        }
      } else {
        // Can play in any board
        for (let boardIndex = 0; boardIndex < 9; boardIndex++) {
          if (tempMainBoard[boardIndex] === null) {
            for (let cellIndex = 0; cellIndex < 9; cellIndex++) {
              if (tempBoards[boardIndex][cellIndex] === null) {
                validMoves.push({ boardIndex, cellIndex })
              }
            }
          }
        }
      }

      // No valid moves
      if (validMoves.length === 0) {
        return { score: 0 }
      }

      let bestMove: { boardIndex: number; cellIndex: number } | undefined

      if (isMaximizing) {
        let maxEval = Number.NEGATIVE_INFINITY

        for (const move of validMoves) {
          // Make the move
          const newBoards = JSON.parse(JSON.stringify(tempBoards))
          newBoards[move.boardIndex][move.cellIndex] = player

          // Check if this move won the small board
          const newMainBoard = [...tempMainBoard]
          const boardWinner = checkBoardWinner(newBoards[move.boardIndex])
          if (boardWinner) {
            newMainBoard[move.boardIndex] = boardWinner
          }

          // Set the next board to play in
          const newNextBoardIndex = newMainBoard[move.cellIndex] === null ? move.cellIndex : -1

          // Recursive call
          const evalResult = minimax(depth - 1, alpha, beta, false, player, newBoards, newMainBoard, newNextBoardIndex)

          if (evalResult.score > maxEval) {
            maxEval = evalResult.score
            bestMove = move
          }

          alpha = Math.max(alpha, evalResult.score)
          if (beta <= alpha) break // Alpha-beta pruning
        }

        return { score: maxEval, move: bestMove }
      } else {
        let minEval = Number.POSITIVE_INFINITY
        const opponent = player === "X" ? "O" : "X"

        for (const move of validMoves) {
          // Make the move
          const newBoards = JSON.parse(JSON.stringify(tempBoards))
          newBoards[move.boardIndex][move.cellIndex] = opponent

          // Check if this move won the small board
          const newMainBoard = [...tempMainBoard]
          const boardWinner = checkBoardWinner(newBoards[move.boardIndex])
          if (boardWinner) {
            newMainBoard[move.boardIndex] = boardWinner
          }

          // Set the next board to play in
          const newNextBoardIndex = newMainBoard[move.cellIndex] === null ? move.cellIndex : -1

          // Recursive call
          const evalResult = minimax(depth - 1, alpha, beta, true, player, newBoards, newMainBoard, newNextBoardIndex)

          if (evalResult.score < minEval) {
            minEval = evalResult.score
            bestMove = move
          }

          beta = Math.min(beta, evalResult.score)
          if (beta <= alpha) break // Alpha-beta pruning
        }

        return { score: minEval, move: bestMove }
      }
    },
    [checkBoardWinner, evaluateBoard],
  )

  // Handle a move
  const handleMove = useCallback(
    (boardIndex: number, cellIndex: number) => {
      // For multiplayer mode, use the multiplayer client
      if (gameMode === "multiplayer" && room) {
        makeMultiplayerMove(boardIndex, cellIndex)
        return
      }

      // For local and AI modes, process the move locally
      if (gameOver) return

      // Check if this board is playable
      if (nextBoardIndex !== -1 && nextBoardIndex !== boardIndex && mainBoard[nextBoardIndex] === null) return

      // Check if the board is already won
      if (mainBoard[boardIndex] !== null) return

      // Check if the cell is already filled
      if (boards[boardIndex][cellIndex] !== null) return

      // Make the move
      const newBoards = [...boards]
      newBoards[boardIndex] = [...boards[boardIndex]]
      newBoards[boardIndex][cellIndex] = currentPlayer
      setBoards(newBoards)

      // Track last move for highlighting
      setLastMove({ boardIndex, cellIndex })

      // Check if this move won the small board
      const boardWinner = checkBoardWinner(newBoards[boardIndex])
      if (boardWinner) {
        const newMainBoard = [...mainBoard]
        newMainBoard[boardIndex] = boardWinner
        setMainBoard(newMainBoard)

        // Check if this won the game
        const gameWinner = checkBoardWinner(newMainBoard as BoardState)
        if (gameWinner) {
          setWinner(gameWinner)
          setGameOver(true)
          return
        }
      }

      // Set the next board to play in
      const nextBoard = mainBoard[cellIndex] === null ? cellIndex : -1
      setNextBoardIndex(nextBoard)

      // Switch player
      setCurrentPlayer(currentPlayer === "X" ? "O" : "X")
    },
    [boards, currentPlayer, gameOver, mainBoard, nextBoardIndex, checkBoardWinner, gameMode, room, makeMultiplayerMove],
  )

  // AI makes a move
  const makeAIMove = useCallback(() => {
    if (gameOver || currentPlayer !== aiPlayer) return

    setAiThinking(true)

    // Use setTimeout to allow UI to update before heavy computation
    setTimeout(() => {
      const startTime = performance.now()

      // Get the best move using minimax
      const result = minimax(
        aiDepth,
        Number.NEGATIVE_INFINITY,
        Number.POSITIVE_INFINITY,
        true,
        aiPlayer,
        boards,
        mainBoard,
        nextBoardIndex,
      )

      const endTime = performance.now()
      console.log(`AI calculation took ${endTime - startTime}ms`)

      if (result.move) {
        handleMove(result.move.boardIndex, result.move.cellIndex)
      }

      setAiThinking(false)
    }, 100)
  }, [aiDepth, aiPlayer, boards, currentPlayer, gameOver, handleMove, mainBoard, minimax, nextBoardIndex])

  // Reset the game
  const resetGame = useCallback(() => {
    // For multiplayer mode, use the multiplayer client
    if (gameMode === "multiplayer" && room) {
      resetMultiplayerGame()
      return
    }

    // For local and AI modes, reset locally
    setBoards(
      Array(9)
        .fill(null)
        .map(() => Array(9).fill(null)),
    )
    setMainBoard(Array(9).fill(null))
    setCurrentPlayer("X")
    setNextBoardIndex(-1)
    setGameOver(false)
    setWinner(null)
    setLastMove(null)
  }, [gameMode, room, resetMultiplayerGame])

  // Toggle AI player
  const toggleAIPlayer = useCallback(() => {
    setAiPlayer(aiPlayer === "X" ? "O" : "X")
    resetGame()
  }, [aiPlayer, resetGame])

  // Change game mode
  const changeGameMode = useCallback(
    (mode: "local" | "ai" | "multiplayer") => {
      // If leaving multiplayer mode, disconnect from room
      if (gameMode === "multiplayer" && mode !== "multiplayer" && room) {
        leaveRoom()
      }

      setGameMode(mode)
      resetGame()

      // Update AI settings based on mode
      if (mode === "ai") {
        setPlayAgainstAI(true)
      } else {
        setPlayAgainstAI(false)
      }
    },
    [gameMode, room, leaveRoom, resetGame],
  )

  // Check if the entire game is a draw
  useEffect(() => {
    if (gameMode !== "multiplayer" && !gameOver && mainBoard.every((board) => board !== null)) {
      const gameWinner = checkBoardWinner(mainBoard as BoardState)
      if (gameWinner) {
        setWinner(gameWinner)
      } else {
        setWinner("draw")
      }
      setGameOver(true)
    }
  }, [mainBoard, gameOver, checkBoardWinner, gameMode])

  // AI makes a move when it's its turn
  useEffect(() => {
    if (gameMode === "ai" && playAgainstAI && currentPlayer === aiPlayer && !gameOver && !aiThinking) {
      const timer = setTimeout(() => {
        makeAIMove()
      }, 500) // Small delay for better UX

      return () => clearTimeout(timer)
    }
  }, [gameMode, playAgainstAI, currentPlayer, aiPlayer, gameOver, aiThinking, makeAIMove])

  // Render a cell in a small board
  const renderCell = (boardIndex: number, cellIndex: number) => {
    const value = boards[boardIndex][cellIndex]
    const isLastMove = lastMove && lastMove.boardIndex === boardIndex && lastMove.cellIndex === cellIndex

    return (
      <button
        key={cellIndex}
        className={`w-8 h-8 md:w-10 md:h-10 flex items-center justify-center text-lg font-bold border border-gray-300 ${
          value === "X" ? "text-blue-500" : value === "O" ? "text-red-500" : ""
        } ${isLastMove ? "bg-yellow-100 border-yellow-400" : ""}`}
        onClick={() => handleMove(boardIndex, cellIndex)}
        disabled={
          gameOver ||
          (nextBoardIndex !== -1 && nextBoardIndex !== boardIndex && mainBoard[nextBoardIndex] === null) ||
          mainBoard[boardIndex] !== null ||
          (gameMode === "ai" && playAgainstAI && currentPlayer === aiPlayer) ||
          aiThinking ||
          (gameMode === "multiplayer" &&
            (playerSymbol === "spectator" ||
              (playerSymbol === "X" && currentPlayer !== "X") ||
              (playerSymbol === "O" && currentPlayer !== "O")))
        }
      >
        {value}
      </button>
    )
  }

  // Render a small board
  const renderBoard = (boardIndex: number) => {
    const isActive = nextBoardIndex === -1 || nextBoardIndex === boardIndex || mainBoard[nextBoardIndex] !== null
    const boardWinner = mainBoard[boardIndex]

    return (
      <div
        key={boardIndex}
        className={`grid grid-cols-3 gap-1 p-1 md:p-2 ${
          boardWinner === "X"
            ? "bg-blue-200"
            : boardWinner === "O"
              ? "bg-red-200"
              : boardWinner === "draw"
                ? "bg-gray-200"
                : isActive && !gameOver && mainBoard[boardIndex] === null
                  ? "bg-yellow-100"
                  : "bg-white"
        } ${boardWinner !== null ? "opacity-80" : ""}`}
      >
        {boardWinner !== null ? (
          <div className="col-span-3 h-full flex items-center justify-center text-3xl font-bold">
            {boardWinner === "draw" ? "Draw" : boardWinner}
          </div>
        ) : (
          Array(9)
            .fill(null)
            .map((_, cellIndex) => renderCell(boardIndex, cellIndex))
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <Tabs
        defaultValue="ai"
        value={gameMode}
        onValueChange={(value) => changeGameMode(value as "local" | "ai" | "multiplayer")}
        className="w-full max-w-md"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="local">Local 2P</TabsTrigger>
          <TabsTrigger value="ai">vs AI</TabsTrigger>
          <TabsTrigger value="multiplayer">Online</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-col md:flex-row items-center gap-4 w-full max-w-md justify-between">
        <div className="flex items-center gap-2">
          <div className={`text-xl font-bold ${currentPlayer === "X" ? "text-blue-500" : "text-red-500"}`}>
            Player {currentPlayer}'s Turn
          </div>
          {aiThinking && currentPlayer === aiPlayer && gameMode === "ai" && (
            <div className="text-sm text-gray-500 animate-pulse">AI thinking...</div>
          )}
          {gameMode === "multiplayer" && playerSymbol && playerSymbol !== "spectator" && (
            <div className="text-sm text-gray-500">
              {currentPlayer === playerSymbol ? "(Your turn)" : "(Opponent's turn)"}
            </div>
          )}
          {gameMode === "multiplayer" && playerSymbol === "spectator" && (
            <div className="text-sm text-gray-500">(Spectating)</div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={resetGame}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Reset Game</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {gameMode === "multiplayer" && (
        <MultiplayerModal
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          roomId={room?.id || null}
          isHost={isHost}
          playerCount={playerCount}
          spectatorCount={spectatorCount}
          playerSymbol={playerSymbol}
          error={multiplayerError}
        />
      )}

      {gameOver && (
        <div className="text-2xl font-bold mb-2">
          {winner === "draw" ? "Game ended in a draw!" : `Player ${winner} wins the game!`}
        </div>
      )}

      <div className="relative mt-4">
        {nextBoardIndex !== -1 && !gameOver && mainBoard[nextBoardIndex] === null && (
          <div className="absolute -top-8 flex items-center gap-2 text-sm text-amber-600">
            <AlertCircle className="h-4 w-4" />
            <span>You must play in the highlighted board</span>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 bg-gray-200 p-2 rounded-lg">
          {Array(9)
            .fill(null)
            .map((_, boardIndex) => renderBoard(boardIndex))}
        </div>
      </div>

      {gameMode === "ai" && (
        <div className="mt-4 w-full max-w-md space-y-4">
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={toggleAIPlayer} className="flex items-center gap-2">
              <User className="h-4 w-4" />
              You play as: {aiPlayer === "X" ? "O" : "X"}
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="ai-depth">AI Difficulty (Looks ahead {aiDepth} moves)</Label>
              <span className="text-sm text-gray-500">
                {aiDepth <= 2 ? "Easy" : aiDepth <= 4 ? "Medium" : aiDepth <= 6 ? "Hard" : "Expert"}
              </span>
            </div>
            <Slider
              id="ai-depth"
              min={1}
              max={8}
              step={1}
              value={[aiDepth]}
              onValueChange={(value) => setAiDepth(value[0])}
            />
          </div>
        </div>
      )}

      <div className="mt-2 max-w-md text-sm text-gray-600">
        <h2 className="font-bold text-lg mb-2">Rules:</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Win three small boards in a row to win the game</li>
          <li>Your move determines which board your opponent must play in next</li>
          <li>If sent to a board that's already won, your opponent can play in any open board</li>
          <li>Highlighted yellow board indicates where you must play</li>
        </ul>
      </div>
    </div>
  )
}
