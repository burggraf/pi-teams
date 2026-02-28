import { describe, expect, it } from 'vitest';
import { getTopModelMatches } from './index';

describe('getTopModelMatches', () => {
    it('returns qwen3-coder-480b for "qwen 480b" queries', () => {
        const modelRegistry = {
            getAvailable: () => [
                { provider: 'abuntu', id: 'Qwen35Coder-122B' },
                { provider: 'abuntu', id: 'qwen3-coder-480b' },
                { provider: 'openai', id: 'o1' },
                { provider: 'openai', id: 'o3' },
                { provider: 'openrouter', id: 'openai/o1' },
                { provider: 'openrouter', id: 'openai/o3' },
                { provider: 'openrouter', id: 'qwen/qwq-32b' },
                { provider: 'openrouter', id: 'qwen/qwen3-coder-480b' }
            ]
        };

        const matches = getTopModelMatches('qwen 480b', modelRegistry, 5);
        const models = matches.map((match) => match.model);

        expect(models[0]).toBe('abuntu/qwen3-coder-480b');
        expect(models).toContain('abuntu/qwen3-coder-480b');
        expect(models).toContain('openrouter/qwen/qwen3-coder-480b');
        expect(models.indexOf('openrouter/qwen/qwen3-coder-480b')).toBeLessThan(models.indexOf('openrouter/qwen/qwq-32b'));
    });
});
