export class LazyResponse {
  private _body: any
  private _init: ResponseInit | undefined
  private _nativeRes: Response | null = null
  private _headers: Headers | null = null
  public _bodyStr: string | null = null
  public _rawHeaders: Record<string, string> | null = null
  public _cookies: string[] | null = null

  constructor(body: any, init?: ResponseInit) {
    this._body = body
    this._init = init
  }

  private _getNative(): Response {
    if (!this._nativeRes) {
      this._nativeRes = new Response(this._body, this._init)
    }
    return this._nativeRes
  }

  get status(): number {
    return this._init?.status ?? 200
  }

  get statusText(): string {
    return this._init?.statusText ?? ""
  }

  get ok(): boolean {
    const s = this.status
    return s >= 200 && s < 300
  }

  get headers(): Headers {
    if (!this._headers) {
      this._headers = new Headers(this._rawHeaders as any)
      if (this._cookies) {
        for (const cookieStr of this._cookies) {
          this._headers.append("Set-Cookie", cookieStr)
        }
      }
    }
    return this._headers
  }

  get body() {
    return this._getNative().body
  }

  get bodyUsed() {
    return this._nativeRes ? this._nativeRes.bodyUsed : false
  }

  arrayBuffer(): Promise<ArrayBuffer> { return this._getNative().arrayBuffer() }
  blob(): Promise<Blob> { return this._getNative().blob() }
  clone(): LazyResponse {
    const cloned = new LazyResponse(this._body, this._init)
    cloned._bodyStr = this._bodyStr
    cloned._rawHeaders = this._rawHeaders
    cloned._cookies = this._cookies
    return cloned
  }
  formData(): Promise<FormData> { return this._getNative().formData() }
  json(): Promise<any> { return this._getNative().json() }
  text(): Promise<string> { return this._getNative().text() }
}

Object.setPrototypeOf(LazyResponse, Response)
Object.setPrototypeOf(LazyResponse.prototype, Response.prototype)
