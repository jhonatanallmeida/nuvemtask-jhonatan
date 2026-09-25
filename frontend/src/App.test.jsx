// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App.jsx'

describe('tela de autenticação', () => {
  it('mostra os campos de cadastro ao selecionar Criar conta', () => {
    sessionStorage.clear()
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(screen.getByLabelText('Seu nome')).not.toBeNull()
    expect(screen.getByLabelText('E-mail')).not.toBeNull()
    expect(screen.getByLabelText('Senha')).not.toBeNull()
  })
})
