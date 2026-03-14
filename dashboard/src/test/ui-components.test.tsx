import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Card, Badge, Spinner, EmptyState } from '../components/ui'

describe('Card', () => {
  it('renders title and children', () => {
    render(
      <Card title="Test Card">
        <p>Card content</p>
      </Card>
    )
    expect(screen.getByText('Test Card')).toBeInTheDocument()
    expect(screen.getByText('Card content')).toBeInTheDocument()
  })

  it('renders subtitle when provided', () => {
    render(
      <Card title="Test" subtitle="This is a subtitle">
        Content
      </Card>
    )
    expect(screen.getByText('This is a subtitle')).toBeInTheDocument()
  })

  it('renders footer when provided', () => {
    render(
      <Card title="Test" footer={<button>Action</button>}>
        Content
      </Card>
    )
    expect(screen.getByText('Action')).toBeInTheDocument()
  })

  it('shows skeleton when loading', () => {
    render(
      <Card title="Test" loading>
        Content
      </Card>
    )
    expect(screen.queryByText('Content')).not.toBeInTheDocument()
  })
})

describe('Badge', () => {
  it('renders children text', () => {
    render(<Badge>Online</Badge>)
    expect(screen.getByText('Online')).toBeInTheDocument()
  })

  it('renders online variant', () => {
    const { container } = render(<Badge variant="online">online</Badge>)
    expect((container.firstChild as Element)?.className).toContain('online')
  })

  it('renders offline variant', () => {
    const { container } = render(<Badge variant="offline">offline</Badge>)
    expect((container.firstChild as Element)?.className).toContain('offline')
  })

  it('renders idle variant (amber)', () => {
    const { container } = render(<Badge variant="idle">idle</Badge>)
    expect((container.firstChild as Element)?.className).toContain('idle')
  })

  it('renders busy variant (blue)', () => {
    const { container } = render(<Badge variant="busy">busy</Badge>)
    expect((container.firstChild as Element)?.className).toContain('busy')
  })

  it('renders dot indicator when dot prop is true', () => {
    render(<Badge dot>Online</Badge>)
    const dot = document.querySelector('span span')
    expect(dot).toBeInTheDocument()
  })
})

describe('Spinner', () => {
  it('renders with default size', () => {
    render(<Spinner />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('renders with label', () => {
    render(<Spinner label="Loading data..." />)
    expect(screen.getByText('Loading data...')).toBeInTheDocument()
  })

  it('renders different sizes', () => {
    const { container: sm } = render(<Spinner size="sm" />)
    const { container: lg } = render(<Spinner size="lg" />)
    expect((sm.firstChild as Element)?.className).toContain('sm')
    expect((lg.firstChild as Element)?.className).toContain('lg')
  })
})

describe('EmptyState', () => {
  it('renders message', () => {
    render(<EmptyState message="No data found" />)
    expect(screen.getByText('No data found')).toBeInTheDocument()
  })

  it('renders description when provided', () => {
    render(
      <EmptyState 
        message="No data" 
        description="There is no data to display" 
      />
    )
    expect(screen.getByText('There is no data to display')).toBeInTheDocument()
  })

  it('renders icon when provided', () => {
    render(
      <EmptyState 
        message="No data" 
        icon={<span data-testid="icon">📭</span>} 
      />
    )
    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })

  it('renders action element when provided', () => {
    render(
      <EmptyState 
        message="No data" 
        action={<button>Add Item</button>} 
      />
    )
    expect(screen.getByText('Add Item')).toBeInTheDocument()
  })
})
