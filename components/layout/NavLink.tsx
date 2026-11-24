'use client'

import Link from 'next/link'
import { useState, type ComponentProps } from 'react'

/**
 * Link del menú: al apoyar el mouse (o el dedo) ya empieza a traer la pantalla
 * completa, así al soltar el clic casi siempre está lista.
 */
export function NavLink(props: ComponentProps<typeof Link>) {
    const [hot, setHot] = useState(false)
    return (
        <Link
            {...props}
            prefetch={hot ? true : null}
            onMouseEnter={() => setHot(true)}
            onTouchStart={() => setHot(true)}
            onFocus={() => setHot(true)}
        />
    )
}
