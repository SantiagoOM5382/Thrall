// Session JWT is stored in this cookie. Keep the string in one place so a
// future rename (or, more likely, a security review that adds Secure/HttpOnly
// options) has only one call site to touch.
export const AUTH_COOKIE_NAME = "arthas_token"
