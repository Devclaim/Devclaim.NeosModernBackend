import React, {forwardRef, type MouseEvent} from 'react';
import {Icon} from '@neos-project/react-ui-components';

type ButtonProps = {
	icon: string;
	title: string;
	id?: string;
	/** pressed: blue (copied, cut, a filter set, its list open) */
	isActive?: boolean;
	disabled?: boolean;
	spin?: boolean;
	onClick(event: MouseEvent<HTMLButtonElement>): void;
	'aria-expanded'?: boolean;
};

/** An icon button of the sidebar: white, blue on hover and while pressed, no background (Neos CI) */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({icon, isActive, spin, ...props}, ref) {
	return (
		<button
			ref={ref}
			type="button"
			className={isActive ? 'devclaim-sidebar__button devclaim-sidebar__button--active' : 'devclaim-sidebar__button'}
			{...props}
		>
			<Icon icon={icon} spin={spin} />
		</button>
	);
});
