// StoneDesk product logo. Served from public/logo-128.png (public/ also has 32 and 180 px copies for
// the browser tab and home-screen icon), so it is cached once and never bundled. Decorative by default,
// because every place it appears also shows the "StoneDesk" name as text.
export default function BrandLogo({ size = 32, className = '', alt = '' }) {
  return <img src="/logo-128.png" width={size} height={size} alt={alt} decoding="async" className={`brand-logo ${className}`} />;
}
