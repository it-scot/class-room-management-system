import '@testing-library/jest-dom';
import { beforeAll, afterEach, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import { HttpResponse, http } from 'msw';

// Default MSW handlers if needed
export const handlers = [
  http.post('/api/bookings/new', () => {
    return HttpResponse.json({ ok: true });
  }),
  http.post('/api/bookings/status', () => {
    return HttpResponse.json({ ok: true });
  })
];

export const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
