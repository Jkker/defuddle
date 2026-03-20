import { afterEach, describe, expect, test } from 'vitest';
import { readFileSync, rmSync, writeFileSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { Readable } from 'stream';
import { Defuddle } from '../src/node';
import { parseSource } from '../src/cli';
import { parseDocument } from './helpers';

const fixturePath = join(__dirname, 'fixtures', 'general--appendix-heading.html');
const fixtureHtml = readFileSync(fixturePath, 'utf-8');

function createStdin(html: string, isTTY = false): NodeJS.ReadStream {
	const stdin = Readable.from([html], { encoding: 'utf8' }) as NodeJS.ReadStream;
	(stdin as NodeJS.ReadStream & { isTTY?: boolean }).isTTY = isTTY;
	return stdin;
}

async function getExpectedContent(html: string): Promise<string> {
	const doc = parseDocument(html);
	const result = await Defuddle(doc);
	return result.content;
}

function normalizeHtmlContent(html: string): string {
	return html
		.replace(/<[^>]*>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

let tempDir: string | undefined;

afterEach(() => {
	if (tempDir) {
		rmSync(tempDir, { recursive: true, force: true });
		tempDir = undefined;
	}
});

describe('CLI parseSource', () => {
	test('reads HTML from stdin when no source is provided', async () => {
		const expected = await getExpectedContent(fixtureHtml);

		const result = await parseSource(undefined, {}, createStdin(fixtureHtml));

		expect(normalizeHtmlContent(result.output)).toEqual(normalizeHtmlContent(expected));
	});

	test('reads HTML from stdin when source is "-"', async () => {
		const result = await parseSource('-', { json: true }, createStdin(fixtureHtml));
		const parsed = JSON.parse(result.output);

		expect(parsed.title).toBe('Article with Appendix');
		expect(parsed.content).toContain('Appendix I');
	});

	test('continues to read local HTML files', async () => {
		tempDir = mkdtempSync(join(tmpdir(), 'defuddle-cli-'));
		const filePath = join(tempDir, 'page.html');
		writeFileSync(filePath, fixtureHtml, 'utf-8');

		const expected = await getExpectedContent(fixtureHtml);
		const result = await parseSource(filePath, {});

		expect(normalizeHtmlContent(result.output)).toEqual(normalizeHtmlContent(expected));
	});

	test('throws a helpful error when no source is provided and stdin is a TTY', async () => {
		const stdin = createStdin('', true);

		await expect(parseSource(undefined, {}, stdin)).rejects.toThrow(
			'No input source provided. Pass a file path or URL, or pipe HTML to stdin.'
		);
	});
});
