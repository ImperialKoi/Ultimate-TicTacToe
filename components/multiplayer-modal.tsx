"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Copy, Users } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"

interface MultiplayerModalProps {
  onCreateRoom: () => void
  onJoinRoom: (roomId: string) => void
  roomId: string | null
  isHost: boolean
  playerCount: number
  spectatorCount: number
  playerSymbol: "X" | "O" | "spectator" | null
  error: string | null
}

export default function MultiplayerModal({
  onCreateRoom,
  onJoinRoom,
  roomId,
  isHost,
  playerCount,
  spectatorCount,
  playerSymbol,
  error,
}: MultiplayerModalProps) {
  const [joinRoomId, setJoinRoomId] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const { toast } = useToast()

  const handleCreateRoom = () => {
    onCreateRoom()
    setIsOpen(false)
  }

  const handleJoinRoom = () => {
    if (joinRoomId.trim() === "") {
      toast({
        title: "Room ID required",
        description: "Please enter a room ID to join",
        variant: "destructive",
      })
      return
    }
    onJoinRoom(joinRoomId.trim().toUpperCase())
    setIsOpen(false)
  }

  const copyRoomId = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId)
      toast({
        title: "Room ID copied",
        description: "Room ID has been copied to clipboard",
      })
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          {roomId ? `Multiplayer (Room: ${roomId})` : "Play Multiplayer"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Multiplayer Game</DialogTitle>
          <DialogDescription>Play Ultimate Tic Tac Toe with friends online</DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {roomId ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Room ID</h3>
                <p className="text-sm text-gray-500">Share this with friends to join your game</p>
              </div>
              <div className="flex items-center gap-2">
                <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm">{roomId}</code>
                <Button variant="outline" size="icon" onClick={copyRoomId}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="font-medium">Game Status</h3>
              <p className="text-sm">
                {playerCount === 1 ? "Waiting for opponent to join..." : `${playerCount} players connected`}
              </p>
              {spectatorCount > 0 && (
                <p className="text-sm text-gray-500">
                  {spectatorCount} {spectatorCount === 1 ? "spectator" : "spectators"} watching
                </p>
              )}
              <p className="text-sm text-gray-500">
                You are{" "}
                {playerSymbol === "spectator" ? "spectating" : `Player ${playerSymbol} ${isHost ? "(host)" : ""}`}
              </p>
            </div>
          </div>
        ) : (
          <Tabs defaultValue="create">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create">Create Game</TabsTrigger>
              <TabsTrigger value="join">Join Game</TabsTrigger>
            </TabsList>
            <TabsContent value="create" className="space-y-4 py-4">
              <div>
                <h3 className="font-medium">Create a new game room</h3>
                <p className="text-sm text-gray-500">Start a new game and invite friends to join</p>
              </div>
              <Button onClick={handleCreateRoom} className="w-full">
                Create Room
              </Button>
            </TabsContent>
            <TabsContent value="join" className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="roomId">Room ID</Label>
                <Input
                  id="roomId"
                  placeholder="Enter room ID"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                />
              </div>
              <Button onClick={handleJoinRoom} className="w-full">
                Join Room
              </Button>
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter className="sm:justify-start">
          <DialogTrigger asChild>
            <Button type="button" variant="secondary">
              Close
            </Button>
          </DialogTrigger>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
