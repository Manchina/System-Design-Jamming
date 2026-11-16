// Real-Time Streaming & WebSocket pub/sub fanout stub (Chapters 11-12)
export interface RealtimeMessage {
  channel: string;
  senderId: string;
  payload: string;
  timestamp: number;
}
