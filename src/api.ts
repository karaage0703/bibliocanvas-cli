/**
 * API client for BiblioCanvas REST API
 */

import { getIdToken, getApiBaseUrl } from './auth.js';

export interface Book {
  bookId: string;
  title: string;
  authors: string;
  acquiredTime: number;
  readStatus: 'NONE' | 'UNREAD' | 'READING' | 'READ' | 'BACKLOG';
  productImage: string;
  source: string;
  addedDate: number;
  rating?: number;
  memo?: string;
  detailPageUrl?: string;
}

export interface Shelf {
  id: string;
  name: string;
  description: string;
  books: string[];
  isPublic: boolean;
  color: string;
}

export interface SearchResult {
  volumeId: string;
  title: string;
  authors: string;
  thumbnail: string;
  isbn?: string;
}

type Env = 'production' | 'development';

async function apiRequest(
  method: string,
  path: string,
  env: Env,
  body?: Record<string, unknown>,
  query?: Record<string, string>
): Promise<unknown> {
  const token = await getIdToken(env);
  const baseUrl = getApiBaseUrl(env);
  let url = `${baseUrl}${path}`;

  if (query) {
    const params = new URLSearchParams(
      Object.entries(query).filter(([, v]) => v !== undefined)
    );
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
  }

  const options: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  if (body && (method === 'POST' || method === 'PATCH')) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      (data as { error?: string }).error || `API error: ${response.status}`
    );
  }

  return data;
}

async function publicApiRequest(
  path: string,
  env: Env,
  query?: Record<string, string>
): Promise<unknown> {
  const baseUrl = getApiBaseUrl(env);
  let url = `${baseUrl}${path}`;

  if (query) {
    const params = new URLSearchParams(
      Object.entries(query).filter(([, v]) => v !== undefined)
    );
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
  }

  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      (data as { error?: string }).error || `API error: ${response.status}`
    );
  }

  return data;
}

// ==================== Public Shelves (no auth required) ====================

export interface PublicShelf {
  id: string;
  name: string;
  description: string;
  ownerUsername: string;
  ownerDisplayName: string;
  slug: string;
  bookCount: number;
  likeCount: number;
  commentCount: number;
  updatedAt: string | null;
  books?: PublicBook[];
}

export interface PublicBook {
  bookId: string;
  title: string;
  authors: string;
  productImage: string;
  rating: number | null;
  memo: string | null;
  readStatus: string | null;
}

export async function listPublicShelves(
  env: Env,
  options?: { limit?: number }
): Promise<{ shelves: PublicShelf[]; total: number }> {
  const query: Record<string, string> = {};
  if (options?.limit) query.limit = options.limit.toString();
  return publicApiRequest('/public/shelves', env, query) as Promise<{
    shelves: PublicShelf[];
    total: number;
  }>;
}

export async function listUserPublicShelves(
  env: Env,
  username: string
): Promise<{ shelves: PublicShelf[]; total: number }> {
  return publicApiRequest(`/public/users/${username}/shelves`, env) as Promise<{
    shelves: PublicShelf[];
    total: number;
  }>;
}

export async function getPublicShelf(
  env: Env,
  shelfId: string,
  options?: { books?: boolean; allBooks?: boolean }
): Promise<PublicShelf> {
  const query: Record<string, string> = {};
  if (options?.books === false) query.books = 'false';
  const shelf = await publicApiRequest(`/public/shelves/${shelfId}`, env, query) as PublicShelf & { hasMore?: boolean };

  // 全書籍を取得する場合、ページネーションで全ページ取得
  if (options?.allBooks !== false && shelf.books && (shelf as unknown as Record<string, unknown>).hasMore) {
    let offset = shelf.books.length;
    while (true) {
      const page = await publicApiRequest(`/public/shelves/${shelfId}`, env, { offset: offset.toString() }) as PublicShelf & { hasMore?: boolean };
      if (!page.books || page.books.length === 0) break;
      shelf.books.push(...page.books);
      offset += page.books.length;
      if (!page.hasMore) break;
    }
  }

  return shelf;
}

// ==================== Books ====================

export async function listBooks(
  env: Env,
  options?: { q?: string; status?: string; sort?: string; dir?: string }
): Promise<{ books: Book[]; total: number }> {
  const query: Record<string, string> = {};
  if (options?.q) query.q = options.q;
  if (options?.status) query.status = options.status;
  if (options?.sort) query.sort = options.sort;
  if (options?.dir) query.dir = options.dir;

  return apiRequest('GET', '/books', env, undefined, query) as Promise<{
    books: Book[];
    total: number;
  }>;
}

export async function getBook(
  env: Env,
  bookId: string
): Promise<Book> {
  return apiRequest('GET', `/books/${bookId}`, env) as Promise<Book>;
}

export async function addBookByIsbn(
  env: Env,
  isbn: string
): Promise<Book> {
  return apiRequest('POST', '/books', env, { isbn }) as Promise<Book>;
}

export async function addBookBySearch(
  env: Env,
  search: string,
  volumeId?: string
): Promise<Book | { message: string; results: SearchResult[] }> {
  const body: Record<string, unknown> = { search };
  if (volumeId) body.volumeId = volumeId;
  return apiRequest('POST', '/books', env, body) as Promise<
    Book | { message: string; results: SearchResult[] }
  >;
}

export async function addBookManual(
  env: Env,
  data: {
    title: string;
    authors?: string;
    readStatus?: string;
    rating?: number;
    memo?: string;
    bookId?: string;
    source?: string;
    productImage?: string;
  }
): Promise<Book> {
  return apiRequest('POST', '/books', env, data) as Promise<Book>;
}

export async function updateBook(
  env: Env,
  bookId: string,
  updates: Record<string, unknown>
): Promise<Book> {
  return apiRequest('PATCH', `/books/${bookId}`, env, updates) as Promise<Book>;
}

export async function deleteBook(
  env: Env,
  bookId: string
): Promise<{ deleted: string }> {
  return apiRequest('DELETE', `/books/${bookId}`, env) as Promise<{
    deleted: string;
  }>;
}

export async function searchBooks(
  env: Env,
  q: string,
  type?: 'isbn' | 'title'
): Promise<{ results: SearchResult[] }> {
  const query: Record<string, string> = { q };
  if (type) query.type = type;
  return apiRequest('GET', '/books/search', env, undefined, query) as Promise<{
    results: SearchResult[];
  }>;
}

// ==================== Shelves ====================

export async function listShelves(
  env: Env
): Promise<{ shelves: Shelf[]; total: number }> {
  return apiRequest('GET', '/shelves', env) as Promise<{
    shelves: Shelf[];
    total: number;
  }>;
}

export async function createShelf(
  env: Env,
  data: { name: string; description?: string; color?: string }
): Promise<Shelf> {
  return apiRequest('POST', '/shelves', env, data) as Promise<Shelf>;
}

export async function updateShelf(
  env: Env,
  shelfId: string,
  updates: Record<string, unknown>
): Promise<Shelf> {
  return apiRequest('PATCH', `/shelves/${shelfId}`, env, updates) as Promise<Shelf>;
}

export async function deleteShelf(
  env: Env,
  shelfId: string
): Promise<{ deleted: string }> {
  return apiRequest('DELETE', `/shelves/${shelfId}`, env) as Promise<{
    deleted: string;
  }>;
}

export async function addBookToShelf(
  env: Env,
  shelfId: string,
  bookId: string
): Promise<{ shelfId: string; bookId: string; added: boolean }> {
  return apiRequest('POST', `/shelves/${shelfId}/books`, env, {
    bookId,
  }) as Promise<{ shelfId: string; bookId: string; added: boolean }>;
}

export async function removeBookFromShelf(
  env: Env,
  shelfId: string,
  bookId: string
): Promise<{ shelfId: string; bookId: string; removed: boolean }> {
  return apiRequest(
    'DELETE',
    `/shelves/${shelfId}/books/${bookId}`,
    env
  ) as Promise<{ shelfId: string; bookId: string; removed: boolean }>;
}

export async function publishShelf(
  env: Env,
  shelfId: string,
  slug?: string
): Promise<{ published: boolean; shelfId: string; slug: string; url: string; bookCount: number }> {
  return apiRequest('POST', `/shelves/${shelfId}/publish`, env, { slug }) as Promise<{
    published: boolean; shelfId: string; slug: string; url: string; bookCount: number;
  }>;
}

export async function unpublishShelf(
  env: Env,
  shelfId: string
): Promise<{ unpublished: boolean; shelfId: string }> {
  return apiRequest('POST', `/shelves/${shelfId}/unpublish`, env) as Promise<{
    unpublished: boolean; shelfId: string;
  }>;
}
