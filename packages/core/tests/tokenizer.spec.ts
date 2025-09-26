
import { describe, expect, it} from 'vitest';
import { tokenizePath } from '../router/tokenizer';

describe('tokenizer', () => {
  it('parses static segments', () => {
    const t = tokenizePath('/a/b/c')
    expect(t).toHaveLength(3)
    expect(t[0]).toMatchObject({type:'static', value: 'a'})
  })

  it('parses param segments', () => {
    const t = tokenizePath('/profile/:id')
    expect(t).toHaveLength(2)
    expect(t[1]).toMatchObject({type:'param', name: 'id'})
  })

  it('parses param with constraints', () => {
    const t = tokenizePath('/profile/:id(\\d+)')
    expect(t[1]).toMatchObject({type:'param', name: 'id', constraint: '\\d+'})
  })

  it('parses wildecard segments', () => {
    const t = tokenizePath('/profile/*username')
    expect(t[1]).toMatchObject({type:'wildcard', name: 'username'})
  })

  it('parses regex fallback segments', () => {
    const t = tokenizePath('/maybe/(anime)?')
    expect(t[1]).toMatchObject({type: 'regex'})
  })

})
