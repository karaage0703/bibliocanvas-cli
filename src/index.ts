#!/usr/bin/env node

/**
 * BiblioCanvas CLI - manage your book library from the command line
 */

import { Command } from 'commander';
import { login, deleteCredentials, getCurrentUser } from './auth.js';
import * as api from './api.js';

const program = new Command();

type Env = 'production' | 'development';

function getEnv(options: { dev?: boolean }): Env {
  return options.dev ? 'development' : 'production';
}

// Status label mapping
const STATUS_LABELS: Record<string, string> = {
  NONE: '-',
  UNREAD: '未読',
  READING: '読書中',
  READ: '読了',
  BACKLOG: '積読',
};

program
  .name('bibliocanvas')
  .description('BiblioCanvas CLI - manage your book library')
  .version('0.1.0');

// ==================== Auth Commands ====================

program
  .command('login')
  .description('Login to BiblioCanvas via Google')
  .option('--dev', 'Use development environment')
  .action(async (options) => {
    try {
      const env = getEnv(options);
      console.log(`Logging in to BiblioCanvas (${env})...`);
      const user = await login(env);
      console.log(`\n✓ Logged in as ${user.displayName || user.email}`);
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program
  .command('logout')
  .description('Logout from BiblioCanvas')
  .action(() => {
    if (deleteCredentials()) {
      console.log('✓ Logged out');
    } else {
      console.log('Not logged in');
    }
  });

program
  .command('whoami')
  .description('Show current user')
  .action(() => {
    const user = getCurrentUser();
    if (user) {
      console.log(`${user.displayName} (${user.email})`);
      console.log(`Environment: ${user.env}`);
    } else {
      console.log('Not logged in. Run `bibliocanvas login` first.');
    }
  });

// ==================== Book Commands ====================

program
  .command('list')
  .description('List books in your library')
  .option('--dev', 'Use development environment')
  .option('-q, --query <text>', 'Search by title or author')
  .option('-s, --status <status>', 'Filter by status (READ,READING,UNREAD,BACKLOG)')
  .option('--sort <field>', 'Sort by field (title, authors, addedDate, rating)', 'addedDate')
  .option('--dir <direction>', 'Sort direction (asc, desc)', 'desc')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    try {
      const env = getEnv(options);
      const result = await api.listBooks(env, {
        q: options.query,
        status: options.status,
        sort: options.sort,
        dir: options.dir,
      });

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log(`\n📚 ${result.total} books\n`);

      if (result.books.length === 0) {
        console.log('No books found.');
        return;
      }

      for (const book of result.books) {
        const status = STATUS_LABELS[book.readStatus] || book.readStatus;
        const rating = book.rating ? '★'.repeat(book.rating) + '☆'.repeat(5 - book.rating) : '';
        console.log(`  ${book.title}`);
        console.log(`    ${book.authors} | ${status}${rating ? ` | ${rating}` : ''}`);
        console.log(`    ID: ${book.bookId}`);
        console.log('');
      }
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program
  .command('add')
  .description('Add a book to your library')
  .option('--dev', 'Use development environment')
  .option('--isbn <isbn>', 'Add by ISBN')
  .option('--title <title>', 'Add by title (manual or search)')
  .option('--search <query>', 'Search Google Books and choose')
  .option('--authors <authors>', 'Author(s) for manual add')
  .option('--status <status>', 'Initial read status', 'UNREAD')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    try {
      const env = getEnv(options);

      if (options.isbn) {
        console.log(`Searching for ISBN: ${options.isbn}...`);
        const book = await api.addBookByIsbn(env, options.isbn);
        if (options.json) {
          console.log(JSON.stringify(book, null, 2));
        } else {
          console.log(`\n✓ Added: ${book.title} (${book.authors})`);
        }
        return;
      }

      if (options.search) {
        console.log(`Searching: ${options.search}...`);
        const result = await api.addBookBySearch(env, options.search);

        if ('results' in result) {
          console.log(`\nFound ${result.results.length} results:\n`);
          result.results.forEach((r: api.SearchResult, i: number) => {
            console.log(`  [${i + 1}] ${r.title}`);
            console.log(`      ${r.authors}`);
            console.log(`      Volume ID: ${r.volumeId}`);
            console.log('');
          });
          console.log('To add a specific book, run:');
          console.log(`  bibliocanvas add --search "${options.search}" --volume-id <volumeId>`);
        } else {
          if (options.json) {
            console.log(JSON.stringify(result, null, 2));
          } else {
            const book = result as api.Book;
            console.log(`\n✓ Added: ${book.title} (${book.authors})`);
          }
        }
        return;
      }

      if (options.title) {
        console.log(`Adding: ${options.title}...`);
        const book = await api.addBookManual(env, {
          title: options.title,
          authors: options.authors,
          readStatus: options.status,
        });
        if (options.json) {
          console.log(JSON.stringify(book, null, 2));
        } else {
          console.log(`\n✓ Added: ${book.title}`);
        }
        return;
      }

      console.error('Specify --isbn, --search, or --title');
      process.exit(1);
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program
  .command('update <bookId>')
  .description('Update a book')
  .option('--dev', 'Use development environment')
  .option('--status <status>', 'Read status (NONE,UNREAD,READING,READ,BACKLOG)')
  .option('--rating <rating>', 'Rating (1-5, or 0 to remove)')
  .option('--memo <memo>', 'Memo text (or "" to remove)')
  .option('--json', 'Output as JSON')
  .action(async (bookId: string, options) => {
    try {
      const env = getEnv(options);
      const updates: Record<string, unknown> = {};

      if (options.status) updates.readStatus = options.status.toUpperCase();
      if (options.rating !== undefined) {
        const r = parseInt(options.rating, 10);
        updates.rating = r === 0 ? null : r;
      }
      if (options.memo !== undefined) {
        updates.memo = options.memo === '' ? null : options.memo;
      }

      if (Object.keys(updates).length === 0) {
        console.error('No updates specified. Use --status, --rating, or --memo');
        process.exit(1);
      }

      const book = await api.updateBook(env, bookId, updates);
      if (options.json) {
        console.log(JSON.stringify(book, null, 2));
      } else {
        console.log(`✓ Updated: ${book.title}`);
        if (updates.readStatus) console.log(`  Status: ${STATUS_LABELS[book.readStatus] || book.readStatus}`);
        if (updates.rating !== undefined) console.log(`  Rating: ${book.rating ? '★'.repeat(book.rating) : 'removed'}`);
        if (updates.memo !== undefined) console.log(`  Memo: ${book.memo || 'removed'}`);
      }
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program
  .command('delete <bookId>')
  .description('Delete a book from your library')
  .option('--dev', 'Use development environment')
  .action(async (bookId: string, options) => {
    try {
      const env = getEnv(options);
      await api.deleteBook(env, bookId);
      console.log(`✓ Deleted: ${bookId}`);
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program
  .command('search <query>')
  .description('Search Google Books')
  .option('--dev', 'Use development environment')
  .option('--isbn', 'Search by ISBN')
  .option('--json', 'Output as JSON')
  .action(async (query: string, options) => {
    try {
      const env = getEnv(options);
      const type = options.isbn ? 'isbn' : 'title';
      const result = await api.searchBooks(env, query, type);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      if (result.results.length === 0) {
        console.log('No results found.');
        return;
      }

      console.log(`\n${result.results.length} results:\n`);
      for (const r of result.results) {
        console.log(`  ${r.title}`);
        console.log(`    ${r.authors}${r.isbn ? ` | ISBN: ${r.isbn}` : ''}`);
        console.log(`    Volume ID: ${r.volumeId}`);
        console.log('');
      }
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

// ==================== Shelf Commands ====================

const shelf = program
  .command('shelf')
  .description('Manage bookshelves');

shelf
  .command('list')
  .description('List bookshelves')
  .option('--dev', 'Use development environment')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    try {
      const env = getEnv(options);
      const result = await api.listShelves(env);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log(`\n📖 ${result.total} shelves\n`);

      for (const s of result.shelves) {
        const pub = s.isPublic ? ' 🌐' : '';
        console.log(`  ${s.name}${pub} (${s.books.length} books)`);
        if (s.description) console.log(`    ${s.description}`);
        console.log(`    ID: ${s.id}`);
        console.log('');
      }
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

shelf
  .command('create <name>')
  .description('Create a bookshelf')
  .option('--dev', 'Use development environment')
  .option('-d, --description <text>', 'Shelf description')
  .option('--color <hex>', 'Theme color', '#6366f1')
  .action(async (name: string, options) => {
    try {
      const env = getEnv(options);
      const s = await api.createShelf(env, {
        name,
        description: options.description,
        color: options.color,
      });
      console.log(`✓ Created shelf: ${s.name} (${s.id})`);
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

shelf
  .command('delete <shelfId>')
  .description('Delete a bookshelf')
  .option('--dev', 'Use development environment')
  .action(async (shelfId: string, options) => {
    try {
      const env = getEnv(options);
      await api.deleteShelf(env, shelfId);
      console.log(`✓ Deleted shelf: ${shelfId}`);
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

shelf
  .command('add-book <shelfId> <bookId>')
  .description('Add a book to a shelf')
  .option('--dev', 'Use development environment')
  .action(async (shelfId: string, bookId: string, options) => {
    try {
      const env = getEnv(options);
      await api.addBookToShelf(env, shelfId, bookId);
      console.log(`✓ Added book ${bookId} to shelf ${shelfId}`);
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

shelf
  .command('remove-book <shelfId> <bookId>')
  .description('Remove a book from a shelf')
  .option('--dev', 'Use development environment')
  .action(async (shelfId: string, bookId: string, options) => {
    try {
      const env = getEnv(options);
      await api.removeBookFromShelf(env, shelfId, bookId);
      console.log(`✓ Removed book ${bookId} from shelf ${shelfId}`);
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program.parse();
