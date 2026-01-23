import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const filterPresetSchema = z.object({
  name: z.string().trim().min(1).max(100),
  filters: z.string(), // JSON string
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const presets = await prisma.filterPreset.findMany({
      where: { userId: session.user.id },
      orderBy: { created_at: 'desc' },
    })

    const formattedPresets = presets.map((preset) => ({
      ...preset,
      filters: JSON.parse(preset.filters),
      created_at: preset.created_at.toISOString(),
      updated_at: preset.updated_at.toISOString(),
    }))

    return NextResponse.json({ presets: formattedPresets })
  } catch (error) {
    console.error('Error fetching filter presets:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = filterPresetSchema.parse(body)

    // Validate filters JSON
    try {
      JSON.parse(data.filters)
    } catch {
      return NextResponse.json(
        { error: 'Invalid filters JSON' },
        { status: 400 }
      )
    }

    const preset = await prisma.filterPreset.create({
      data: {
        userId: session.user.id,
        name: data.name.trim(),
        filters: data.filters,
      },
    })

    return NextResponse.json(
      {
        preset: {
          ...preset,
          filters: JSON.parse(preset.filters),
          created_at: preset.created_at.toISOString(),
          updated_at: preset.updated_at.toISOString(),
        },
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error creating filter preset:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

