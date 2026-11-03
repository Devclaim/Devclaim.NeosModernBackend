/*
 * The roles of an account in the user module (Partials/UserModule/Module/Shared/RolesSelection.html): a ticked role
 * ticks and locks the roles it contains ("Enthalten in …"); locked, they are disabled and not sent, so the account keeps
 * only the roles ticked by hand. Below them what the ticked roles allow altogether. Without this script the roles are
 * plain checkboxes, as in Neos.
 */
document.addEventListener('DOMContentLoaded', () => {
	document.querySelectorAll('[data-dc-roles]').forEach((container) => {
		const rows = Array.from(container.querySelectorAll('[data-dc-role]')).map((row) => ({
			row,
			identifier: row.dataset.dcRole,
			contains: (row.dataset.dcContains || '').split(' ').filter(Boolean),
			check: row.querySelector('input[type="checkbox"]'),
			label: row.querySelector('.dc-role__label')?.textContent.trim() ?? '',
			included: row.querySelector('[data-dc-included]'),
			permissions: Array.from(row.querySelectorAll('[data-dc-permission]'), (element) => element.textContent.trim()),
		}));
		const summary = container.querySelector('[data-dc-summary-text]');

		const update = () => {
			// who includes whom, from the roles ticked by hand (a locked one ticks nothing)
			const includedBy = new Map();
			rows.filter((role) => role.check.checked && !role.check.disabled).forEach((role) => {
				role.contains.forEach((identifier) => includedBy.has(identifier) || includedBy.set(identifier, role.label));
			});
			rows.forEach((role) => {
				const by = includedBy.get(role.identifier);
				role.check.disabled = by !== undefined;
				if (by !== undefined) role.check.checked = true;
				role.row.toggleAttribute('data-dc-locked', by !== undefined);
				role.included.hidden = by === undefined;
				role.included.textContent = by === undefined ? '' : `${container.dataset.dcIncludedIn} ${by}`;
			});
			const permissions = [...new Set(rows.filter((role) => role.check.checked).flatMap((role) => role.permissions))];
			summary.hidden = false;
			summary.textContent = permissions.length > 0
				? `${container.dataset.dcSummary}: ${permissions.join(' · ')}`
				: container.dataset.dcSummaryNone;
		};

		// a role that is no longer included becomes a role of its own again, unticked
		container.addEventListener('change', (event) => {
			const changed = rows.find((role) => role.check === event.target);
			if (changed && !changed.check.checked) {
				rows.filter((role) => role.check.disabled && changed.contains.includes(role.identifier)).forEach((role) => {
					role.check.disabled = false;
					role.check.checked = false;
				});
			}
			update();
		});

		// the roles an account had by hand next to a role containing them: shown as included, not sent again
		update();
	});
});
