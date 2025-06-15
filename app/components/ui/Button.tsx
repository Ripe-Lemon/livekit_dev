import React, { forwardRef, ButtonHTMLAttributes } from 'react';
import { LoadingSpinner } from './LoadingSpinner';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'warning';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
    loadingText?: string;
    icon?: React.ReactNode;
    iconPosition?: 'left' | 'right';
    fullWidth?: boolean;
    children: React.ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
    variant = 'primary',
    size = 'md',
    loading = false,
    loadingText,
    icon,
    iconPosition = 'left',
    fullWidth = false,
    className = '',
    disabled,
    children,
    ...props
}, ref) => {
    // 基础样式
    const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed';

    // 变体样式
    const variantStyles = {
        primary: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500 shadow-sm',
        secondary: 'bg-gray-600 hover:bg-gray-700 text-white focus:ring-gray-500 shadow-sm',
        outline: 'border border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white hover:bg-gray-800 focus:ring-gray-500',
        ghost: 'text-gray-300 hover:text-white hover:bg-gray-800 focus:ring-gray-500',
        danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500 shadow-sm',
        success: 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-500 shadow-sm',
        warning: 'bg-yellow-600 hover:bg-yellow-700 text-white focus:ring-yellow-500 shadow-sm'
    };

    // 尺寸样式
    const sizeStyles = {
        xs: 'px-2 py-1 text-xs gap-1',
        sm: 'px-3 py-1.5 text-sm gap-1.5',
        md: 'px-4 py-2 text-sm gap-2',
        lg: 'px-6 py-3 text-base gap-2',
        xl: 'px-8 py-4 text-lg gap-3'
    };

    // 图标尺寸
    const iconSizes = {
        xs: 'w-3 h-3',
        sm: 'w-3.5 h-3.5',
        md: 'w-4 h-4',
        lg: 'w-5 h-5',
        xl: 'w-6 h-6'
    };

    // 组合样式
    const combinedClassName = [
        baseStyles,
        variantStyles[variant],
        sizeStyles[size],
        fullWidth ? 'w-full' : '',
        className
    ].filter(Boolean).join(' ');

    const isDisabled = disabled || loading;

    return (
        <button
            ref={ref}
            className={combinedClassName}
            disabled={isDisabled}
            {...props}
        >
            {loading ? (
                <>
                    <LoadingSpinner size="sm" />
                    {loadingText || children}
                </>
            ) : (
                <>
                    {icon && iconPosition === 'left' && (
                        <span className={`flex-shrink-0 ${iconSizes[size]}`}>
                            {icon}
                        </span>
                    )}
                    {children}
                    {icon && iconPosition === 'right' && (
                        <span className={`flex-shrink-0 ${iconSizes[size]}`}>
                            {icon}
                        </span>
                    )}
                </>
            )}
        </button>
    );
});

Button.displayName = 'Button';

export { Button };
export type { ButtonProps, ButtonVariant, ButtonSize };