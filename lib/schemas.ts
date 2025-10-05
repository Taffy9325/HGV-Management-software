import { z } from 'zod'

// DVSA Walkaround Check Schema
export const DVSAWalkaroundSchema = z.object({
  vehicle_id: z.string().uuid(),
  driver_id: z.string().uuid(),
  check_date: z.string().datetime(),
  mileage: z.number().int().positive(),
  checks: z.object({
    lights: z.object({
      headlights: z.enum(['pass', 'fail', 'not_applicable']),
      indicators: z.enum(['pass', 'fail', 'not_applicable']),
      brake_lights: z.enum(['pass', 'fail', 'not_applicable']),
      hazard_lights: z.enum(['pass', 'fail', 'not_applicable']),
      fog_lights: z.enum(['pass', 'fail', 'not_applicable']),
      reversing_lights: z.enum(['pass', 'fail', 'not_applicable'])
    }),
    tyres: z.object({
      front_left: z.enum(['pass', 'fail', 'not_applicable']),
      front_right: z.enum(['pass', 'fail', 'not_applicable']),
      rear_left: z.enum(['pass', 'fail', 'not_applicable']),
      rear_right: z.enum(['pass', 'fail', 'not_applicable']),
      spare_tyre: z.enum(['pass', 'fail', 'not_applicable']).optional()
    }),
    brakes: z.object({
      handbrake: z.enum(['pass', 'fail', 'not_applicable']),
      footbrake: z.enum(['pass', 'fail', 'not_applicable']),
      air_pressure: z.enum(['pass', 'fail', 'not_applicable']),
      brake_pipes: z.enum(['pass', 'fail', 'not_applicable']),
      brake_drums: z.enum(['pass', 'fail', 'not_applicable'])
    }),
    steering: z.object({
      steering_wheel: z.enum(['pass', 'fail', 'not_applicable']),
      steering_box: z.enum(['pass', 'fail', 'not_applicable']),
      power_steering: z.enum(['pass', 'fail', 'not_applicable'])
    }),
    suspension: z.object({
      springs: z.enum(['pass', 'fail', 'not_applicable']),
      shock_absorbers: z.enum(['pass', 'fail', 'not_applicable']),
      air_suspension: z.enum(['pass', 'fail', 'not_applicable'])
    }),
    bodywork: z.object({
      cab: z.enum(['pass', 'fail', 'not_applicable']),
      doors: z.enum(['pass', 'fail', 'not_applicable']),
      mirrors: z.enum(['pass', 'fail', 'not_applicable']),
      windscreen: z.enum(['pass', 'fail', 'not_applicable']),
      wipers: z.enum(['pass', 'fail', 'not_applicable'])
    }),
    load_securing: z.object({
      load_bed: z.enum(['pass', 'fail', 'not_applicable']),
      securing_points: z.enum(['pass', 'fail', 'not_applicable']),
      tarpaulin: z.enum(['pass', 'fail', 'not_applicable']).optional()
    }),
    coupling: z.object({
      fifth_wheel: z.enum(['pass', 'fail', 'not_applicable']).optional(),
      kingpin: z.enum(['pass', 'fail', 'not_applicable']).optional(),
      air_lines: z.enum(['pass', 'fail', 'not_applicable']).optional(),
      electrical_connection: z.enum(['pass', 'fail', 'not_applicable']).optional()
    }),
    exhaust: z.object({
      emissions: z.enum(['pass', 'fail', 'not_applicable']),
      smoke_test: z.enum(['pass', 'fail', 'not_applicable']),
      adr_equipment: z.enum(['pass', 'fail', 'not_applicable']).optional()
    })
  }),
  defects: z.array(z.object({
    category: z.string(),
    description: z.string(),
    severity: z.enum(['minor', 'major', 'dangerous']),
    location: z.string(),
    photos: z.array(z.string()).optional()
  })).optional(),
  nil_defect: z.boolean().default(false),
  vor_required: z.boolean().default(false),
  notes: z.string().optional()
})

// Defect Report Schema
export const DefectReportSchema = z.object({
  defect_id: z.string().uuid().optional(),
  vehicle_id: z.string().uuid(),
  driver_id: z.string().uuid(),
  defect_type: z.string(),
  severity: z.enum(['minor', 'major', 'dangerous']),
  description: z.string(),
  location: z.string(),
  reported_at: z.string().datetime(),
  photos: z.array(z.string()).optional(), // Supabase storage paths
  repair_required: z.boolean().default(true),
  vor_immediate: z.boolean().default(false),
  estimated_repair_cost: z.number().optional(),
  repair_deadline: z.string().datetime().optional()
})

// Safety Inspection (PMI) Schema
export const SafetyInspectionSchema = z.object({
  inspection_id: z.string().uuid().optional(),
  vehicle_id: z.string().uuid(),
  inspector_id: z.string().uuid(),
  inspection_date: z.string().datetime(),
  inspection_type: z.enum(['annual', 'interim', 'ad_hoc']),
  mileage: z.number().int().positive(),
  brake_test: z.object({
    front_brake_efficiency: z.number().min(0).max(100),
    rear_brake_efficiency: z.number().min(0).max(100),
    parking_brake_efficiency: z.number().min(0).max(100),
    brake_balance: z.number().min(0).max(100),
    brake_test_passed: z.boolean()
  }),
  emissions_test: z.object({
    smoke_opacity: z.number().min(0).max(100),
    emissions_passed: z.boolean(),
    test_certificate_number: z.string().optional()
  }),
  tyre_condition: z.object({
    front_left_depth: z.number().min(0).max(10),
    front_right_depth: z.number().min(0).max(10),
    rear_left_depth: z.number().min(0).max(10),
    rear_right_depth: z.number().min(0).max(10),
    minimum_depth_met: z.boolean()
  }),
  defects_found: z.array(DefectReportSchema).optional(),
  inspection_passed: z.boolean(),
  next_inspection_due: z.string().datetime(),
  inspector_signature: z.string().optional(),
  inspector_certificate_number: z.string()
})

// Tachograph Schedule Schema
export const TachographScheduleSchema = z.object({
  vehicle_id: z.string().uuid(),
  driver_id: z.string().uuid(),
  card_number: z.string(),
  card_expiry: z.string().datetime(),
  vu_download_due: z.string().datetime(),
  driver_card_download_due: z.string().datetime(),
  last_download_date: z.string().datetime().optional(),
  download_frequency_days: z.number().int().min(1).max(90),
  compliance_status: z.enum(['compliant', 'warning', 'non_compliant'])
})

// MOT Reminder Schema
export const MOTReminderSchema = z.object({
  vehicle_id: z.string().uuid(),
  registration: z.string(),
  make: z.string(),
  model: z.string(),
  mot_expiry_date: z.string().datetime(),
  last_mot_date: z.string().datetime().optional(),
  advisories: z.array(z.string()).optional(),
  test_number: z.string().optional(),
  reminder_sent: z.boolean().default(false),
  reminder_date: z.string().datetime().optional()
})

// Order Schema
export const OrderSchema = z.object({
  order_number: z.string(),
  consignor: z.object({
    name: z.string(),
    address: z.object({
      line1: z.string(),
      line2: z.string().optional(),
      city: z.string(),
      postcode: z.string(),
      country: z.string().default('GB')
    }),
    contact: z.object({
      name: z.string(),
      phone: z.string(),
      email: z.string().email()
    })
  }),
  consignee: z.object({
    name: z.string(),
    address: z.object({
      line1: z.string(),
      line2: z.string().optional(),
      city: z.string(),
      postcode: z.string(),
      country: z.string().default('GB')
    }),
    contact: z.object({
      name: z.string(),
      phone: z.string(),
      email: z.string().email()
    })
  }),
  pickup_window: z.object({
    start: z.string().datetime(),
    end: z.string().datetime()
  }),
  delivery_window: z.object({
    start: z.string().datetime(),
    end: z.string().datetime()
  }),
  load_details: z.object({
    weight: z.number().positive(),
    volume: z.number().positive().optional(),
    height: z.number().positive().optional(),
    length: z.number().positive().optional(),
    width: z.number().positive().optional(),
    pallets: z.number().int().positive().optional(),
    temperature_controlled: z.boolean().default(false),
    temperature_range: z.object({
      min: z.number(),
      max: z.number()
    }).optional(),
    hazardous: z.boolean().default(false),
    adr_classifications: z.array(z.string()).optional()
  }),
  special_instructions: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal')
})

// Job Schema
export const JobSchema = z.object({
  order_id: z.string().uuid(),
  driver_id: z.string().uuid(),
  vehicle_id: z.string().uuid(),
  status: z.enum(['planned', 'dispatched', 'accepted', 'in_progress', 'completed', 'cancelled']),
  planned_start: z.string().datetime(),
  planned_end: z.string().datetime(),
  actual_start: z.string().datetime().optional(),
  actual_end: z.string().datetime().optional(),
  route_plan: z.object({
    waypoints: z.array(z.object({
      order: z.number().int(),
      location: z.object({
        lat: z.number(),
        lng: z.number(),
        address: z.string()
      }),
      type: z.enum(['pickup', 'delivery', 'break', 'fuel']),
      estimated_arrival: z.string().datetime(),
      estimated_departure: z.string().datetime(),
      actual_arrival: z.string().datetime().optional(),
      actual_departure: z.string().datetime().optional()
    })),
    total_distance: z.number(),
    total_duration: z.number(),
    fuel_stops: z.array(z.object({
      location: z.object({
        lat: z.number(),
        lng: z.number(),
        name: z.string()
      }),
      estimated_arrival: z.string().datetime()
    })).optional()
  }).optional()
})

// Type exports
export type DVSAWalkaround = z.infer<typeof DVSAWalkaroundSchema>
export type DefectReport = z.infer<typeof DefectReportSchema>
export type SafetyInspection = z.infer<typeof SafetyInspectionSchema>
export type TachographSchedule = z.infer<typeof TachographScheduleSchema>
export type MOTReminder = z.infer<typeof MOTReminderSchema>
export type Order = z.infer<typeof OrderSchema>
export type Job = z.infer<typeof JobSchema>

