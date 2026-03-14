import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResourcePanel } from './ResourcePanel'
import type { ContainerResource } from '../../types/container'

// Mock data for testing
const mockContainers: ContainerResource[] = [
  {
    containerId: 'abc123',
    name: 'hiclaw-manager',
    cpuPercent: 45.5,
    memoryUsage: 536870912, // 512 MB
    memoryLimit: 1073741824, // 1 GB
    networkRx: 1024,
    networkTx: 2048,
    containerStatus: 'running',
    idleSince: null,
    autoStoppedAt: null,
    lastStartedAt: '2024-01-01T10:00:00Z',
  },
  {
    containerId: 'def456',
    name: 'hiclaw-worker-alice',
    cpuPercent: 78.2,
    memoryUsage: 268435456, // 256 MB
    memoryLimit: 536870912, // 512 MB
    networkRx: 512,
    networkTx: 1024,
    containerStatus: 'running',
    idleSince: null,
    autoStoppedAt: null,
    lastStartedAt: '2024-01-01T11:00:00Z',
  },
  {
    containerId: 'ghi789',
    name: 'hiclaw-worker-bob',
    cpuPercent: 0,
    memoryUsage: 0,
    memoryLimit: 536870912,
    networkRx: 0,
    networkTx: 0,
    containerStatus: 'stopped',
    idleSince: '2024-01-01T12:00:00Z',
    autoStoppedAt: null,
    lastStartedAt: '2024-01-01T09:00:00Z',
  },
]

describe('ResourcePanel', () => {
  it('renders container list with correct data', () => {
    render(<ResourcePanel containers={mockContainers} />)
    
    expect(screen.getByTestId('resource-panel')).toBeInTheDocument()
    
    // Check container names are rendered
    expect(screen.getByText('hiclaw-manager')).toBeInTheDocument()
    expect(screen.getByText('hiclaw-worker-alice')).toBeInTheDocument()
    expect(screen.getByText('hiclaw-worker-bob')).toBeInTheDocument()
  })

  it('displays CPU usage as progress bars', () => {
    render(<ResourcePanel containers={mockContainers} />)
    
    // Check CPU bars exist
    const cpuBars = screen.getAllByTestId(/^resource-cpu-/)
    expect(cpuBars.length).toBe(3)
  })

  it('displays memory usage as progress bars', () => {
    render(<ResourcePanel containers={mockContainers} />)
    
    // Check memory bars exist
    const memoryBars = screen.getAllByTestId(/^resource-memory-/)
    expect(memoryBars.length).toBe(3)
  })

  it('displays correct container status', () => {
    render(<ResourcePanel containers={mockContainers} />)
    
    // Check status indicators
    const runningStatus = screen.getAllByText('running')
    expect(runningStatus.length).toBe(2)
    
    const stoppedStatus = screen.getAllByText('stopped')
    expect(stoppedStatus.length).toBe(1)
  })

  it('displays memory usage values', () => {
    render(<ResourcePanel containers={mockContainers} />)
    
    // Use getAllByText since memory values appear multiple times
    expect(screen.getAllByText(/512 MB/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/256 MB/).length).toBeGreaterThan(0)
  })

  it('renders empty state when containers array is empty', () => {
    render(<ResourcePanel containers={[]} />)
    
    expect(screen.getByTestId('resource-panel')).toBeInTheDocument()
    expect(screen.getByTestId('resource-empty')).toBeInTheDocument()
    expect(screen.getByText(/Resource monitoring unavailable/)).toBeInTheDocument()
  })

  it('calculates memory percentage correctly', () => {
    render(<ResourcePanel containers={mockContainers} />)
    
    // Manager: 512MB / 1GB = 50%
    const managerCpuBar = screen.getByTestId('resource-cpu-hiclaw-manager')
    expect(managerCpuBar).toHaveStyle({ width: '45.5%' })
    
    const managerMemoryBar = screen.getByTestId('resource-memory-hiclaw-manager')
    expect(managerMemoryBar).toHaveStyle({ width: '50%' })
  })

  it('shows data-testid attributes for each container', () => {
    render(<ResourcePanel containers={mockContainers} />)
    
    expect(screen.getByTestId('resource-container-abc123')).toBeInTheDocument()
    expect(screen.getByTestId('resource-container-def456')).toBeInTheDocument()
    expect(screen.getByTestId('resource-container-ghi789')).toBeInTheDocument()
  })

  it('handles containers with zero memory limit', () => {
    const zeroLimitContainer: ContainerResource[] = [
      {
        containerId: 'test123',
        name: 'test-container',
        cpuPercent: 10,
        memoryUsage: 100,
        memoryLimit: 0,
        networkRx: 0,
        networkTx: 0,
        containerStatus: 'running',
        idleSince: null,
        autoStoppedAt: null,
        lastStartedAt: null,
      },
    ]
    
    render(<ResourcePanel containers={zeroLimitContainer} />)
    
    // Should not crash and should handle gracefully
    expect(screen.getByTestId('resource-panel')).toBeInTheDocument()
    expect(screen.getByTestId('resource-container-test123')).toBeInTheDocument()
  })
})
