import {siteUrl} from '../lib/server';export default function robots(){return {rules:{userAgent:'*',allow:'/',disallow:['/studio','/preview/','/api/']},sitemap:siteUrl()+'/sitemap.xml'}}
