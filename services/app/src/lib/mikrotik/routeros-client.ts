import net from "net";
import tls from "tls";
import crypto from "crypto";
import { encodeSentence, parseRawSentences } from "./routeros-protocol";

export interface RouterosOptions {
  host: string;
  port?: number;
  username: string;
  password?: string;
  useTls?: boolean;
  timeoutMs?: number;
}

export class RouterosClient {
  private host: string;
  private port: number;
  private user: string;
  private pass: string;
  private useTls: boolean;
  private timeoutMs: number;
  private socket: net.Socket | tls.TLSSocket | null = null;
  private isConnected = false;

  constructor(opts: RouterosOptions) {
    this.host = opts.host;
    this.port = opts.port || (opts.useTls ? 8729 : 8728);
    this.user = opts.username;
    this.pass = opts.password || "";
    this.useTls = Boolean(opts.useTls);
    this.timeoutMs = opts.timeoutMs || 4000;
  }

  public async connect(): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      let resolved = false;

      const onConnect = async () => {
        try {
          const authOk = await this.authenticate();
          if (!resolved) {
            resolved = true;
            this.isConnected = authOk;
            resolve(authOk);
          }
        } catch (authErr) {
          if (!resolved) {
            resolved = true;
            this.disconnect();
            reject(authErr);
          }
        }
      };

      const onError = (err: Error) => {
        if (!resolved) {
          resolved = true;
          this.disconnect();
          reject(err);
        }
      };

      if (this.useTls) {
        this.socket = tls.connect(
          {
            host: this.host,
            port: this.port,
            rejectUnauthorized: false,
          },
          onConnect
        );
      } else {
        this.socket = net.createConnection(
          {
            host: this.host,
            port: this.port,
          },
          onConnect
        );
      }

      this.socket.setTimeout(this.timeoutMs);
      this.socket.on("error", onError);
      this.socket.on("timeout", () => {
        if (!resolved) {
          resolved = true;
          this.disconnect();
          reject(new Error(`Timeout de conexión a RouterOS en ${this.host}:${this.port}`));
        }
      });
    });
  }

  private async authenticate(): Promise<boolean> {
    // Standard login for RouterOS v6.43+ and RouterOS v7+
    const directLogin = await this.executeSentence([
      "/login",
      `=name=${this.user}`,
      `=password=${this.pass}`,
    ]);
    if (
      directLogin.done &&
      !directLogin.trap &&
      directLogin.sentences.length === 0
    ) {
      return true;
    }

    // Challenge-response fallback (legacy RouterOS < v6.43)
    const challenge = directLogin.sentences[0]?.ret;
    if (challenge) {
      const chalBuf = Buffer.from(challenge, "hex");
      const passBuf = Buffer.from(this.pass, "utf-8");
      const md5 = crypto.createHash("md5");
      md5.update(Buffer.from([0x00]));
      md5.update(passBuf);
      md5.update(chalBuf);
      const digest = md5.digest("hex");

      const secondLogin = await this.executeSentence([
        "/login",
        `=name=${this.user}`,
        `=response=00${digest}`,
      ]);
      return secondLogin.done && !secondLogin.trap;
    }

    return false;
  }

  public async executeSentence(
    words: string[]
  ): Promise<{
    sentences: Array<Record<string, string>>;
    done: boolean;
    trap: boolean;
    error?: string;
  }> {
    if (!this.socket || this.socket.destroyed) {
      throw new Error("Socket RouterOS no está conectado.");
    }
    const currentSocket = this.socket;

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      const onData = (data: Buffer) => {
        chunks.push(data);
        const parsed = parseRawSentences(chunks);
        if (parsed.done || parsed.trap) {
          cleanup();
          resolve({
            sentences: parsed.sentences,
            done: parsed.done,
            trap: parsed.trap,
            error: parsed.errorMessage,
          });
        }
      };

      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };

      const onTimeout = () => {
        cleanup();
        reject(new Error("Timeout al esperar respuesta de comando RouterOS."));
      };

      const cleanup = () => {
        currentSocket.off("data", onData);
        currentSocket.off("error", onError);
        currentSocket.off("timeout", onTimeout);
      };

      currentSocket.on("data", onData);
      currentSocket.once("error", onError);
      currentSocket.once("timeout", onTimeout);

      const packet = encodeSentence(words);
      currentSocket.write(packet);
    });
  }

  public disconnect(): void {
    if (this.socket) {
      try {
        this.socket.destroy();
      } catch (_err) {
        // Ignored
      }
      this.socket = null;
    }
    this.isConnected = false;
  }

  public getConnected(): boolean {
    return this.isConnected;
  }
}
