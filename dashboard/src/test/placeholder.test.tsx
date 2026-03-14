import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import App from '../App'
import { Layout } from '../components/Layout'
import { Dashboard } from '../pages/Dashboard'

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders with React Router', () => {
    render(<App />)
    expect(screen.getByText('HiClaw Mission Control')).toBeInTheDocument()
  })
})

describe('Layout', () => {
  it('renders header with title', () => {
    render(
      <BrowserRouter>
        <Layout>Test content</Layout>
      </BrowserRouter>
    )
    expect(screen.getByText('HiClaw Mission Control')).toBeInTheDocument()
  })

  it('renders sidebar placeholder', () => {
    render(
      <BrowserRouter>
        <Layout>Test content</Layout>
      </BrowserRouter>
    )
    expect(screen.getByText('Sidebar')).toBeInTheDocument()
  })

  it('renders children content', () => {
    render(
      <BrowserRouter>
        <Layout>Test content</Layout>
      </BrowserRouter>
    )
    expect(screen.getByText('Test content')).toBeInTheDocument()
  })
})

describe('Dashboard', () => {
  it('renders dashboard page', () => {
    render(<Dashboard />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('renders welcome message', () => {
    render(<Dashboard />)
    expect(screen.getByText('Welcome to HiClaw Mission Control')).toBeInTheDocument()
  })
})
