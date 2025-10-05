import { Order, Job } from './schemas'

export interface Vehicle {
  id: string
  registration: string
  make: string
  model: string
  year: number
  maxWeight: number
  maxHeight: number
  maxLength: number
  maxWidth: number
  adrClassifications: string[]
  fuelType: 'diesel' | 'petrol' | 'electric' | 'hybrid'
  currentLocation: {
    lat: number
    lng: number
  }
  status: 'available' | 'in_use' | 'maintenance' | 'out_of_service'
}

export interface Driver {
  id: string
  name: string
  licenceNumber: string
  licenceExpiry: string
  cpcExpiry: string
  tachoCardExpiry: string
  currentLocation: {
    lat: number
    lng: number
  }
  status: 'available' | 'on_duty' | 'on_break' | 'off_duty'
  maxDrivingHours: number
  currentDrivingHours: number
}

export interface RouteConstraints {
  maxDrivingHours: number
  breakRequirements: BreakRule[]
  vehicleRestrictions: VehicleRestriction[]
  timeWindows: boolean
  adrRestrictions: boolean
  lezCompliance: boolean
}

export interface BreakRule {
  type: 'daily_break' | 'weekly_break' | 'driving_break'
  duration: number // minutes
  frequency: number // hours
}

export interface VehicleRestriction {
  vehicleId: string
  restrictions: {
    maxWeight?: number
    maxHeight?: number
    adrClasses?: string[]
    lezCompliant?: boolean
  }
}

export interface RouteOptimizationResult {
  assignments: Record<string, string> // orderId -> vehicleId
  routes: Record<string, RoutePlan>
  totalDistance: number
  totalDuration: number
  totalCost: number
  violations: ConstraintViolation[]
}

export interface RoutePlan {
  vehicleId: string
  driverId: string
  waypoints: Waypoint[]
  totalDistance: number
  totalDuration: number
  breaks: Break[]
  fuelStops: FuelStop[]
}

export interface Waypoint {
  order: number
  orderId: string
  location: {
    lat: number
    lng: number
    address: string
  }
  type: 'pickup' | 'delivery'
  timeWindow: {
    start: string
    end: string
  }
  estimatedArrival: string
  estimatedDeparture: string
  serviceTime: number // minutes
}

export interface Break {
  location: {
    lat: number
    lng: number
    name: string
  }
  startTime: string
  endTime: string
  duration: number // minutes
  type: 'daily_break' | 'weekly_break' | 'driving_break'
}

export interface FuelStop {
  location: {
    lat: number
    lng: number
    name: string
  }
  estimatedArrival: string
  estimatedDuration: number // minutes
  fuelRequired: number // litres
}

export interface ConstraintViolation {
  type: 'time_window' | 'weight_capacity' | 'height_restriction' | 'driving_hours' | 'break_requirement'
  severity: 'warning' | 'error'
  message: string
  orderId?: string
  vehicleId?: string
}

/**
 * VRPTW Solver using Adaptive Large Neighbourhood Search
 */
export class VRPTWSolver {
  private orders: Order[]
  private vehicles: Vehicle[]
  private drivers: Driver[]
  private constraints: RouteConstraints

  constructor(
    orders: Order[],
    vehicles: Vehicle[],
    drivers: Driver[],
    constraints: RouteConstraints
  ) {
    this.orders = orders
    this.vehicles = vehicles
    this.drivers = drivers
    this.constraints = constraints
  }

  /**
   * Solve the Vehicle Routing Problem with Time Windows
   */
  async solve(): Promise<RouteOptimizationResult> {
    // Initialize with greedy assignment
    const initialSolution = this.greedyInitialSolution()
    
    // Apply Adaptive Large Neighbourhood Search
    let bestSolution = initialSolution
    let currentSolution = initialSolution
    
    for (let iteration = 0; iteration < 100; iteration++) {
      // Destroy and repair
      const destroyedSolution = this.destroy(currentSolution)
      const repairedSolution = await this.repair(destroyedSolution)
      
      // Accept if better
      if (this.getSolutionCost(repairedSolution) < this.getSolutionCost(bestSolution)) {
        bestSolution = repairedSolution
      }
      
      currentSolution = repairedSolution
    }
    
    return bestSolution
  }

  /**
   * Greedy initial solution
   */
  private greedyInitialSolution(): RouteOptimizationResult {
    const assignments: Record<string, string> = {}
    const routes: Record<string, RoutePlan> = {}
    const violations: ConstraintViolation[] = []
    
    // Sort orders by priority and time window
    const sortedOrders = [...this.orders].sort((a, b) => {
      if (a.priority !== b.priority) {
        const priorityOrder = { urgent: 4, high: 3, normal: 2, low: 1 }
        return priorityOrder[b.priority] - priorityOrder[a.priority]
      }
      return new Date(a.pickup_window.start).getTime() - new Date(b.pickup_window.start).getTime()
    })
    
    // Assign orders to vehicles
    for (const order of sortedOrders) {
      const bestVehicle = this.findBestVehicleForOrder(order, assignments)
      
      if (bestVehicle) {
        assignments[order.order_number] = bestVehicle.id
        
        if (!routes[bestVehicle.id]) {
          routes[bestVehicle.id] = this.createEmptyRoute(bestVehicle)
        }
        
        this.addOrderToRoute(routes[bestVehicle.id], order)
      } else {
        violations.push({
          type: 'time_window',
          severity: 'error',
          message: `No suitable vehicle found for order ${order.order_number}`,
          orderId: order.order_number
        })
      }
    }
    
    // Optimize routes
    for (const vehicleId in routes) {
      routes[vehicleId] = this.optimizeRoute(routes[vehicleId])
    }
    
    return {
      assignments,
      routes,
      totalDistance: this.calculateTotalDistance(routes),
      totalDuration: this.calculateTotalDuration(routes),
      totalCost: this.calculateTotalCost(routes),
      violations
    }
  }

  /**
   * Find best vehicle for an order considering constraints
   */
  private findBestVehicleForOrder(
    order: Order,
    currentAssignments: Record<string, string>
  ): Vehicle | null {
    const suitableVehicles = this.vehicles.filter(vehicle => {
      // Check weight capacity
      if (order.load_details.weight > vehicle.maxWeight) {
        return false
      }
      
      // Check height restrictions
      if (order.load_details.height && order.load_details.height > vehicle.maxHeight) {
        return false
      }
      
      // Check ADR requirements
      if (order.load_details.adr_classifications) {
        const hasRequiredADR = order.load_details.adr_classifications.every(
          adrClass => vehicle.adrClassifications.includes(adrClass)
        )
        if (!hasRequiredADR) {
          return false
        }
      }
      
      // Check vehicle status
      if (vehicle.status !== 'available') {
        return false
      }
      
      return true
    })
    
    if (suitableVehicles.length === 0) {
      return null
    }
    
    // Find vehicle with minimum additional cost
    let bestVehicle: Vehicle | null = null
    let minCost = Infinity
    
    for (const vehicle of suitableVehicles) {
      const cost = this.calculateAssignmentCost(vehicle, order, currentAssignments)
      if (cost < minCost) {
        minCost = cost
        bestVehicle = vehicle
      }
    }
    
    return bestVehicle
  }

  /**
   * Calculate assignment cost for a vehicle-order pair
   */
  private calculateAssignmentCost(
    vehicle: Vehicle,
    order: Order,
    currentAssignments: Record<string, string>
  ): number {
    // Distance cost - using consignor address as pickup location
    // Note: In a real implementation, you'd geocode the address to get lat/lng
    const pickupLocation = { lat: 53.4808, lng: -2.2426 } // Mock Manchester coordinates
    const distance = this.calculateDistance(
      vehicle.currentLocation,
      pickupLocation
    )
    
    // Time window penalty
    const timeWindowPenalty = this.calculateTimeWindowPenalty(order, vehicle)
    
    // Capacity utilization
    const capacityUtilization = order.load_details.weight / vehicle.maxWeight
    
    return distance * 0.1 + timeWindowPenalty * 100 + (1 - capacityUtilization) * 50
  }

  /**
   * Calculate distance between two points (simplified)
   */
  private calculateDistance(point1: { lat: number; lng: number }, point2: { lat: number; lng: number }): number {
    const R = 6371 // Earth's radius in km
    const dLat = (point2.lat - point1.lat) * Math.PI / 180
    const dLng = (point2.lng - point1.lng) * Math.PI / 180
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }

  /**
   * Calculate time window penalty
   */
  private calculateTimeWindowPenalty(order: Order, vehicle: Vehicle): number {
    // Simplified - in production, use actual routing service
    const estimatedArrival = new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours from now
    const windowStart = new Date(order.pickup_window.start)
    const windowEnd = new Date(order.pickup_window.end)
    
    if (estimatedArrival < windowStart) {
      return (windowStart.getTime() - estimatedArrival.getTime()) / (1000 * 60) // minutes early
    } else if (estimatedArrival > windowEnd) {
      return (estimatedArrival.getTime() - windowEnd.getTime()) / (1000 * 60) // minutes late
    }
    
    return 0
  }

  /**
   * Create empty route for a vehicle
   */
  private createEmptyRoute(vehicle: Vehicle): RoutePlan {
    return {
      vehicleId: vehicle.id,
      driverId: '', // Will be assigned later
      waypoints: [],
      totalDistance: 0,
      totalDuration: 0,
      breaks: [],
      fuelStops: []
    }
  }

  /**
   * Add order to route
   */
  private addOrderToRoute(route: RoutePlan, order: Order): void {
    const pickupWaypoint: Waypoint = {
      order: route.waypoints.length + 1,
      orderId: order.order_number,
      location: {
        lat: 53.4808, // Mock Manchester coordinates
        lng: -2.2426,
        address: order.consignor.address.line1
      },
      type: 'pickup',
      timeWindow: order.pickup_window,
      estimatedArrival: order.pickup_window.start,
      estimatedDeparture: order.pickup_window.start,
      serviceTime: 30 // 30 minutes service time
    }
    
    const deliveryWaypoint: Waypoint = {
      order: route.waypoints.length + 2,
      orderId: order.order_number,
      location: {
        lat: 53.4084, // Mock Liverpool coordinates
        lng: -2.9916,
        address: order.consignee.address.line1
      },
      type: 'delivery',
      timeWindow: order.delivery_window,
      estimatedArrival: order.delivery_window.start,
      estimatedDeparture: order.delivery_window.start,
      serviceTime: 30
    }
    
    route.waypoints.push(pickupWaypoint, deliveryWaypoint)
  }

  /**
   * Optimize route using 2-opt
   */
  private optimizeRoute(route: RoutePlan): RoutePlan {
    // Simplified 2-opt implementation
    let improved = true
    let bestRoute = { ...route }
    
    while (improved) {
      improved = false
      
      for (let i = 1; i < route.waypoints.length - 1; i++) {
        for (let j = i + 1; j < route.waypoints.length; j++) {
          const newRoute = this.twoOptSwap(route, i, j)
          if (this.getRouteCost(newRoute) < this.getRouteCost(bestRoute)) {
            bestRoute = newRoute
            improved = true
          }
        }
      }
      
      route = bestRoute
    }
    
    return bestRoute
  }

  /**
   * Perform 2-opt swap
   */
  private twoOptSwap(route: RoutePlan, i: number, j: number): RoutePlan {
    const newWaypoints = [...route.waypoints]
    
    // Reverse the segment between i and j
    for (let k = i; k <= j; k++) {
      newWaypoints[k] = route.waypoints[j - (k - i)]
    }
    
    return {
      ...route,
      waypoints: newWaypoints
    }
  }

  /**
   * Destroy operation for ALNS
   */
  private destroy(solution: RouteOptimizationResult): RouteOptimizationResult {
    // Remove 10% of orders randomly
    const ordersToRemove = Math.floor(this.orders.length * 0.1)
    const removedOrders: string[] = []
    
    for (let i = 0; i < ordersToRemove; i++) {
      const randomOrder = this.orders[Math.floor(Math.random() * this.orders.length)]
      if (!removedOrders.includes(randomOrder.order_number)) {
        removedOrders.push(randomOrder.order_number)
        delete solution.assignments[randomOrder.order_number]
      }
    }
    
    return solution
  }

  /**
   * Repair operation for ALNS
   */
  private async repair(solution: RouteOptimizationResult): Promise<RouteOptimizationResult> {
    // Re-assign removed orders using greedy approach
    const unassignedOrders = this.orders.filter(order => !solution.assignments[order.order_number])
    
    for (const order of unassignedOrders) {
      const bestVehicle = this.findBestVehicleForOrder(order, solution.assignments)
      if (bestVehicle) {
        solution.assignments[order.order_number] = bestVehicle.id
        
        if (!solution.routes[bestVehicle.id]) {
          solution.routes[bestVehicle.id] = this.createEmptyRoute(bestVehicle)
        }
        
        this.addOrderToRoute(solution.routes[bestVehicle.id], order)
      }
    }
    
    return solution
  }

  /**
   * Calculate solution cost
   */
  private getSolutionCost(solution: RouteOptimizationResult): number {
    return solution.totalCost + solution.violations.length * 1000
  }

  /**
   * Calculate route cost
   */
  private getRouteCost(route: RoutePlan): number {
    return route.totalDistance * 0.5 + route.totalDuration * 0.1
  }

  /**
   * Calculate total distance
   */
  private calculateTotalDistance(routes: Record<string, RoutePlan>): number {
    return Object.values(routes).reduce((sum, route) => sum + route.totalDistance, 0)
  }

  /**
   * Calculate total duration
   */
  private calculateTotalDuration(routes: Record<string, RoutePlan>): number {
    return Object.values(routes).reduce((sum, route) => sum + route.totalDuration, 0)
  }

  /**
   * Calculate total cost
   */
  private calculateTotalCost(routes: Record<string, RoutePlan>): number {
    return Object.values(routes).reduce((sum, route) => sum + this.getRouteCost(route), 0)
  }
}

/**
 * ETA Prediction using historical data and live traffic
 */
export class ETAPredictor {
  private historicalData: Map<string, number[]> = new Map()
  
  /**
   * Predict ETA for a route segment
   */
  async predictETA(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
    vehicleType: string,
    timeOfDay: Date
  ): Promise<number> {
    const routeKey = `${from.lat},${from.lng}-${to.lat},${to.lng}`
    
    // Get historical data
    const historicalTimes = this.historicalData.get(routeKey) || []
    
    // Get live traffic data (simplified)
    const liveTrafficFactor = await this.getLiveTrafficFactor(from, to, timeOfDay)
    
    // Calculate base time
    const distance = this.calculateDistance(from, to)
    const baseTime = distance / 50 * 60 // Assume 50 km/h average speed
    
    // Apply traffic factor
    const adjustedTime = baseTime * liveTrafficFactor
    
    // Use historical data to refine prediction
    if (historicalTimes.length > 0) {
      const avgHistoricalTime = historicalTimes.reduce((sum, time) => sum + time, 0) / historicalTimes.length
      return (adjustedTime + avgHistoricalTime) / 2
    }
    
    return adjustedTime
  }
  
  /**
   * Get live traffic factor
   */
  private async getLiveTrafficFactor(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
    timeOfDay: Date
  ): Promise<number> {
    // Simplified - in production, integrate with traffic API
    const hour = timeOfDay.getHours()
    
    // Peak hours have higher traffic
    if (hour >= 7 && hour <= 9) return 1.5 // Morning rush
    if (hour >= 17 && hour <= 19) return 1.4 // Evening rush
    
    return 1.0 // Normal traffic
  }
  
  /**
   * Calculate distance between two points
   */
  private calculateDistance(point1: { lat: number; lng: number }, point2: { lat: number; lng: number }): number {
    const R = 6371 // Earth's radius in km
    const dLat = (point2.lat - point1.lat) * Math.PI / 180
    const dLng = (point2.lng - point1.lng) * Math.PI / 180
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }
  
  /**
   * Update historical data with actual travel time
   */
  updateHistoricalData(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
    actualTime: number
  ): void {
    const routeKey = `${from.lat},${from.lng}-${to.lat},${to.lng}`
    const historicalTimes = this.historicalData.get(routeKey) || []
    
    historicalTimes.push(actualTime)
    
    // Keep only last 100 records
    if (historicalTimes.length > 100) {
      historicalTimes.shift()
    }
    
    this.historicalData.set(routeKey, historicalTimes)
  }
}

